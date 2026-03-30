import { CACHE_KEYS, CACHE_TTL, cacheService } from '../../services/cache.service';
import { logger } from '../../utils/logger';
import { AttributeGroupModel as AttributeGroup } from '../attribute-group/attribute-group.model';
import { updateLastShownAt } from '../feeds/feeds.service';
import { ProfileModel as Profile } from '../profile/profile.model';
import { extractCategoryFromFeatures } from '../profile/profile.service';
import { sortProfiles } from '../visibility/visibility.service';
import type {
  FilterOptions,
  FilterQuery,
  FilterResponse,
} from './filters.types';

/**
 * Obtiene todos los perfiles con filtros aplicados
 */
export const getFilteredProfiles = async (
  filters: FilterQuery,
): Promise<FilterResponse> => {
  try {
    const {
      category,
      location,
      priceRange,
      availability,
      isActive,
      isVerified,
      profileVerified,
      documentVerified,
      noDeposito,
      hasDestacadoUpgrade,
      hasVideos,
      page = 1,
      limit = 20,
      // sortBy = 'createdAt',
      // sortOrder = 'desc',
      fields,
    } = filters;

    // Generar clave de caché basada en los filtros
    const cacheKey = cacheService.generateKey(
      CACHE_KEYS.FILTERS,
      JSON.stringify(filters)
    );

    // Intentar obtener del caché primero
    const cachedResult = await cacheService.get<FilterResponse>(cacheKey);
    if (cachedResult) {
      logger.info(`Cache hit para filtros: ${cacheKey}`);
      return cachedResult;
    }

    let features = filters.features;

    // Construir query de MongoDB
    const query: any = {};

    // Alinear con home feed: solo perfiles visibles, no eliminados
    const now = new Date();
    query.visible = true;
    query.isDeleted = { $ne: true };

    // CRÍTICO: Excluir perfiles sin planAssignment (perfiles en proceso, no listos para público)
    query.planAssignment = { $exists: true, $ne: null };
    query['planAssignment.expiresAt'] = { $gt: now };

    // Por defecto, solo mostrar perfiles activos (isActive: true)
    // El frontend puede sobrescribir esto enviando isActive: false explícitamente
    if (isActive !== undefined) {
      query.isActive = isActive;
    } else {
      // Si no se especifica, filtrar solo perfiles activos por defecto
      query.isActive = true;
    }

    // ✨ CASO ESPECIAL: Categoría "perfiles" = todos los perfiles activos y visibles
    // Validar antes que cualquier otro filtro de categoría
    if (category && category.toLowerCase() === 'perfiles') {
      logger.info('📋 [FILTROS] Categoría "perfiles" detectada - mostrando todos los perfiles activos y visibles');
      // No aplicar filtro de categoría - mostrar todos los perfiles
      // Los filtros de ubicación, precio, etc. seguirán aplicándose
      // Simplemente no agregamos la categoría a las features
    } else if (category) {
      // Filtro por categoría específica (escorts, masajistas, etc.)
      // Buscar el AttributeGroup de 'category' para validar que existe
      let categoryFeatureId: any = null;
      const categoryGroup = await AttributeGroup.findOne({ key: 'category' });

      if (categoryGroup) {
        // Si existe el grupo, agregar a features para procesarla después
        if (!features) {
          features = {};
        }
        features.category = category;
        categoryFeatureId = categoryGroup._id;
      } else {
        // ⚠️ ADVERTENCIA: No existe AttributeGroup con key='category'
        // Esto causará que no se retornen resultados cuando se filtre por categoría
        console.warn('⚠️ [FILTROS] No existe AttributeGroup con key="category". El filtro de categoría no funcionará.');
        console.warn('⚠️ [FILTROS] Se debe crear el grupo de atributos "category" con las variantes: escorts, masajistas, modelos, etc.');

        // Retornar respuesta vacía inmediatamente
        return {
          profiles: [],
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit,
        };
      }
    }

    // Filtro por ubicación
    if (location) {
      if (location.country) {
        query['location.country'] = location.country;
      }
      if (location.department) {
        query['location.department.value'] = location.department;
      }
      if (location.city) {
        query['location.city.value'] = location.city;
      }
    }

    // Filtro por verificación (MOVIDO a la agregación para filtrar correctamente después del lookup)
    // if (isVerified !== undefined) {
    //   query['user.isVerified'] = isVerified;
    // }

    // Filtro por verificación de selfie (Fotos verificadas)
    if (profileVerified !== undefined) {
      // Buscar perfiles que tengan selfieVerification completada
      const profileVerificationQuery = await Profile.aggregate([
        {
          $lookup: {
            from: 'profileverifications',
            localField: 'verification',
            foreignField: '_id',
            as: 'verificationData'
          }
        },
        {
          $match: {
            'verificationData.steps.selfieVerification.isVerified': profileVerified
          }
        },
        {
          $project: {
            _id: 1
          }
        }
      ]);

      const verifiedProfileIds = profileVerificationQuery.map(p => p._id);

      if (profileVerified) {
        // Solo incluir perfiles con selfie verificado
        query._id = { $in: verifiedProfileIds };
      } else {
        // Excluir perfiles con selfie verificado
        query._id = { $nin: verifiedProfileIds };
      }
    }

    // Filtro por verificación de documentos (basado en frontPhotoVerification y selfieVerification)
    if (documentVerified !== undefined) {
      // Buscar perfiles que tengan ambas verificaciones de documentos completadas
      const documentVerificationQuery = await Profile.aggregate([
        {
          $lookup: {
            from: 'profileverifications',
            localField: 'verification',
            foreignField: '_id',
            as: 'verificationData'
          }
        },
        {
          $match: {
            $and: [
              { 'verificationData.steps.frontPhotoVerification.isVerified': documentVerified },
              { 'verificationData.steps.selfieVerification.isVerified': documentVerified }
            ]
          }
        },
        {
          $project: {
            _id: 1
          }
        }
      ]);

      const documentVerifiedProfileIds = documentVerificationQuery.map(p => p._id);

      if (documentVerified) {
        // Solo incluir perfiles con documentos verificados
        if (query._id && query._id.$in) {
          // Si ya hay filtro de profileVerified, hacer intersección
          query._id = { $in: query._id.$in.filter((id: any) => documentVerifiedProfileIds.some(docId => docId.equals(id))) };
        } else if (query._id && query._id.$nin) {
          // Si hay exclusión previa, combinar con inclusión de documentos
          query._id = { $in: documentVerifiedProfileIds, $nin: query._id.$nin };
        } else {
          query._id = { $in: documentVerifiedProfileIds };
        }
      } else {
        // Excluir perfiles con documentos verificados
        if (query._id && query._id.$in) {
          // Si ya hay inclusión, filtrar excluyendo documentos verificados
          query._id = { $in: query._id.$in.filter((id: any) => !documentVerifiedProfileIds.some(docId => docId.equals(id))) };
        } else if (query._id && query._id.$nin) {
          // Si ya hay exclusión, agregar más IDs a excluir
          query._id = { $nin: [...query._id.$nin, ...documentVerifiedProfileIds] };
        } else {
          query._id = { $nin: documentVerifiedProfileIds };
        }
      }
    }

    // Filtro por destacado (upgrade activo)
    if (hasDestacadoUpgrade !== undefined && hasDestacadoUpgrade) {
      const now = new Date();
      query.$or = [
        // Perfiles con upgrade DESTACADO/HIGHLIGHT activo
        {
          upgrades: {
            $elemMatch: {
              code: { $in: ['DESTACADO', 'HIGHLIGHT'] },
              startAt: { $lte: now },
              endAt: { $gt: now }
            }
          }
        },
        // Perfiles con plan DIAMANTE
        {
          'planAssignment.planCode': 'DIAMANTE'
        }
      ];
    }

    // Filtro por videos
    if (hasVideos !== undefined && hasVideos) {
      query['media.videos'] = { $exists: true, $not: { $size: 0 } };
    }

    // Filtro por "No pide anticipo" (deposito === false en profileVerification)
    if (noDeposito === true) {
      const noDepositoQuery = await Profile.aggregate([
        {
          $lookup: {
            from: 'profileverifications',
            localField: 'verification',
            foreignField: '_id',
            as: 'verificationData'
          }
        },
        {
          $match: {
            'verificationData.steps.deposito': false
          }
        },
        {
          $project: {
            _id: 1
          }
        }
      ]);

      const noDepositoIds = noDepositoQuery.map(p => p._id);

      if (query._id && query._id.$in) {
        query._id = { $in: query._id.$in.filter((id: any) => noDepositoIds.some((nid: any) => nid.equals(id))) };
      } else if (query._id && query._id.$nin) {
        query._id = { $in: noDepositoIds, $nin: query._id.$nin };
      } else {
        query._id = { $in: noDepositoIds };
      }
    }

    // Filtro por características (features)
    if (features && Object.keys(features).length > 0) {
      const featureConditions: any[] = [];

      // Manejo especial para ageRange
      if (features.ageRange && typeof features.ageRange === 'object') {
        const { min, max } = features.ageRange as { min?: number; max?: number };

        if (min !== undefined || max !== undefined) {
          // SOLUCIÓN: Usar $expr para convertir string a number en la comparación
          const ageConditions: any[] = [];

          if (min !== undefined) {
            ageConditions.push({
              $expr: {
                $gte: [{ $toInt: "$age" }, min]
              }
            });
          }

          if (max !== undefined) {
            ageConditions.push({
              $expr: {
                $lte: [{ $toInt: "$age" }, max]
              }
            });
          }

          // Si ya existe $and, agregar las condiciones, si no, crearla
          if (query.$and) {
            query.$and.push(...ageConditions);
          } else {
            query.$and = ageConditions;
          }

        }
      }

      // Procesar otras características (excluyendo ageRange)
      const otherFeatures = Object.fromEntries(
        Object.entries(features).filter(([key]) => key !== 'ageRange')
      );

      if (Object.keys(otherFeatures).length > 0) {
        // Primero necesitamos obtener los IDs de los grupos por sus keys
        const groupKeys = Object.keys(otherFeatures);

        const attributeGroups = await AttributeGroup.find({
          key: { $in: groupKeys },
        });

        const groupKeyToId = new Map();
        attributeGroups.forEach((group) => {
          groupKeyToId.set(group.key, group._id);
        });

        for (const [groupKey, value] of Object.entries(otherFeatures)) {
          const groupId = groupKeyToId.get(groupKey);

          if (!groupId) {
            console.warn('⚠️ No groupId found for feature key:', groupKey);
            continue;
          }

          if (Array.isArray(value)) {
            // Si es un array, buscar cualquiera de los valores (normalizados)
            const normalizedValues = value.map((v) => v.toLowerCase().trim());

            const condition = {
              features: {
                $elemMatch: {
                  group_id: groupId,
                  'value.key': { $in: normalizedValues },
                },
              },
            };

            featureConditions.push(condition);
          } else {
            // Si es un valor único (normalizado) - buscar en el array de valores del perfil
            const normalizedValue = (value as string).toLowerCase().trim();

            const condition = {
              features: {
                $elemMatch: {
                  group_id: groupId,
                  'value.key': normalizedValue,
                },
              },
            };

            featureConditions.push(condition);
          }
        }

        if (featureConditions.length > 0) {
          // Si ya existe $and (por ejemplo, de ageRange), agregar las condiciones en lugar de sobrescribir
          if (query.$and) {
            query.$and.push(...featureConditions);
          } else {
            query.$and = featureConditions;
          }
        }
      }
    }

    // Filtro por rango de precios
    if (priceRange) {
      const priceConditions: any = {};
      if (priceRange.min !== undefined) {
        priceConditions.$gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        priceConditions.$lte = priceRange.max;
      }

      if (Object.keys(priceConditions).length > 0) {
        query['rates.price'] = priceConditions;
      }
    }

    // Filtro por disponibilidad
    if (availability) {
      const availabilityConditions: any[] = [];

      if (availability.dayOfWeek) {
        const dayCondition = {
          availability: {
            $elemMatch: {
              dayOfWeek: availability.dayOfWeek,
            },
          },
        };
        availabilityConditions.push(dayCondition);
      }

      if (
        availability.timeSlot &&
        (availability.timeSlot.start || availability.timeSlot.end)
      ) {
        const timeCondition: any = {
          availability: {
            $elemMatch: {
              slots: {
                $elemMatch: {
                  ...(availability.timeSlot.start && {
                    start: { $lte: availability.timeSlot.start },
                  }),
                  ...(availability.timeSlot.end && {
                    end: { $gte: availability.timeSlot.end },
                  }),
                },
              },
            },
          },
        };
        availabilityConditions.push(timeCondition);
      }

      if (availabilityConditions.length > 0) {
        if (query.$and) {
          query.$and.push(...availabilityConditions);
        } else {
          query.$and = availabilityConditions;
        }
      }
    }

    // Configurar paginación
    const skip = (page - 1) * limit;

    // Determinar campos a seleccionar: asegurar campos requeridos por el motor de visibilidad
    const requiredFields = ['planAssignment', 'upgrades', 'lastShownAt', 'createdAt', 'features'];

    // Campos mínimos necesarios para ProfileCard
    const profileCardFields = [
      '_id',
      'name',
      'age',
      'location',
      'contact', // IMPORTANTE: Necesario para verificación dinámica
      'description',
      'verification',
      'media.gallery',
      'online',
      'hasVideo'
    ];

    const startTime = Date.now();

    // ── Pipeline optimizado: solo se transfieren los campos necesarios en cada etapa ──
    const aggregationPipeline: any[] = [
      { $match: query },

      // 1. User lookup limitado a _id e isVerified (evita traer todo el documento)
      {
        $lookup: {
          from: 'users',
          let: { userId: '$user' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
            { $project: { _id: 1, isVerified: 1 } }
          ],
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          _userIsVerified: { $arrayElemAt: ['$userInfo.isVerified', 0] }
        }
      },
      { $project: { userInfo: 0 } },

      // ✨ SEGURIDAD: solo perfiles de usuarios verificados
      { $match: { _userIsVerified: true } },

      // 2. Proyección temprana del perfil: reduce el tamaño del documento antes de los lookups pesados
      {
        $project: {
          _id: 1,
          name: 1,
          age: 1,
          location: 1,
          description: 1,
          // Solo la primera imagen de galería (la tarjeta no necesita más)
          'media.gallery': { $slice: ['$media.gallery', 1] },
          online: 1,
          hasVideo: 1,
          verification: 1,
          planAssignment: 1,
          upgrades: 1,
          lastShownAt: 1,
          createdAt: 1,
          features: 1,
        }
      },

      // 3. Verification lookup: solo campos usados en el frontend y en el motor de visibilidad
      {
        $lookup: {
          from: 'profileverifications',
          let: { verificationId: '$verification' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$verificationId'] } } },
            {
              $project: {
                _id: 1,
                verificationProgress: 1,
                verificationStatus: 1,
                'steps.selfieVerification.isVerified': 1,
                'steps.deposito': 1,
              }
            }
          ],
          as: 'verification'
        }
      },
      { $addFields: { verification: { $arrayElemAt: ['$verification', 0] } } },

      // 4. Plan lookup: solo level y code (necesarios para sortProfiles)
      {
        $lookup: {
          from: 'plandefinitions',
          let: { planId: '$planAssignment.planId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$planId'] } } },
            { $project: { _id: 1, level: 1, code: 1 } }
          ],
          as: 'planAssignmentPlan'
        }
      },
      { $addFields: { 'planAssignment.planId': { $arrayElemAt: ['$planAssignmentPlan', 0] } } },
      { $project: { planAssignmentPlan: 0 } },

      // 5. AttributeGroups lookup: solo campos para extraer categoría
      {
        $lookup: {
          from: 'attributegroups',
          localField: 'features.group_id',
          foreignField: '_id',
          as: 'featureGroups',
          pipeline: [{ $project: { _id: 1, key: 1, name: 1, label: 1 } }]
        }
      },
    ];

    // Ejecutar pipeline de perfiles y conteo en paralelo
    // El conteo también filtra por usuario verificado para que coincida con el resultado real
    const [allProfiles, totalCountResult] = await Promise.all([
      Profile.aggregate(aggregationPipeline),
      Profile.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            let: { userId: '$user' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
              { $project: { _id: 1, isVerified: 1 } }
            ],
            as: 'userInfo'
          }
        },
        { $match: { 'userInfo.isVerified': true } },
        { $count: 'total' }
      ])
    ]);

    const totalCount = totalCountResult[0]?.total || 0;

    console.log(`📊 [FILTROS DEBUG] Perfiles después de agregación: ${allProfiles.length}`);
    console.log(`📊 [FILTROS DEBUG] Total count: ${totalCount}`);
    console.log(`📊 [FILTROS DEBUG] Perfiles con plan válido: ${allProfiles.filter((p: any) => p.planAssignment?.planId).length}`);

    console.log(`\n📊 [FILTROS] Ordenando ${allProfiles.length} perfiles encontrados (página ${page}, límite ${limit})`);

    // Ordenar perfiles usando el servicio de visibilidad
    // Pasamos 'FILTERS' como contexto para diferenciar logs
    const sortedProfiles = await sortProfiles(allProfiles as any, now, 'FILTERS');

    // Aplicar paginación sobre los resultados ordenados
    const paginatedProfiles = sortedProfiles.slice(skip, skip + limit);

    console.log(`\n📄 [FILTROS] Mostrando perfiles ${skip + 1} a ${skip + paginatedProfiles.length} de ${totalCount} totales`);

    // Actualizar lastShownAt para los perfiles servidos (rotación justa)
    if (paginatedProfiles.length > 0) {
      await updateLastShownAt(paginatedProfiles.map(p => (p._id as any).toString()));
    }

    const executionTime = Date.now() - startTime;
    void executionTime; // mantener variable para debugging futuro si se requiere

    // Calcular información de paginación
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const paginationInfo = {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      limit,
    };

    const profilesWithVerification = paginatedProfiles.map((rawProfile, index) => {
      const profile = rawProfile as any;

      // Calcular estado de verificación basado directamente en el progreso de la DB
      const verification = (typeof profile.verification === 'object' && profile.verification !== null)
        ? profile.verification
        : {};

      const progress = (verification as any).verificationProgress || 0;
      let isVerified = false;
      let verificationLevel = 'pending';

      if (progress === 100) {
        isVerified = true;
        verificationLevel = 'verified';
      } else if (progress > 0) {
        verificationLevel = 'partial';
      }

      // Lógica de Destacado
      let hasDestacadoUpgrade = false;
      if (profile.planAssignment?.planCode === 'DIAMANTE') {
        hasDestacadoUpgrade = true;
      } else if (Array.isArray(profile.upgrades)) {
        hasDestacadoUpgrade = profile.upgrades.some((upgrade: any) =>
          ['DESTACADO', 'HIGHLIGHT'].includes(upgrade.code) &&
          upgrade.startAt && upgrade.endAt &&
          new Date(upgrade.startAt) <= now &&
          new Date(upgrade.endAt) > now
        );
      }

      // Poblar features usando featureGroups del lookup del pipeline
      const populatedFeatures = Array.isArray(profile.features)
        ? profile.features.map((f: any) => {
          const group = Array.isArray(profile.featureGroups)
            ? profile.featureGroups.find((g: any) => g._id.toString() === f.group_id?.toString())
            : undefined;
          return { ...f, group_id: group || f.group_id };
        })
        : [];

      const category = extractCategoryFromFeatures(populatedFeatures);

      if (index === 0) {
        console.log('🔍 [FILTROS DEBUG] Extracted category:', category);
      }

      // Respuesta mínima para el frontend (ProfileCard)
      return {
        _id: profile._id,
        name: profile.name,
        age: profile.age,
        location: profile.location,
        description: profile.description,
        media: { gallery: profile.media?.gallery || [] },
        online: profile.online,
        hasVideo: profile.hasVideo,
        hasDestacadoUpgrade,
        category,
        verification: {
          isVerified,
          verificationLevel,
          verificationProgress: progress,
          steps: {
            selfieVerification: (verification as any).steps?.selfieVerification,
            deposito: (verification as any).steps?.deposito,
          },
        },
      };
    });

    const result = {
      ...paginationInfo,
      profiles: profilesWithVerification,
    };

    // Guardar resultado en caché (5 minutos para consultas de filtros)
    await cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Obtiene las opciones disponibles para los filtros
 */
export const getFilterOptions = async (): Promise<FilterOptions> => {
  try {
    // Intentar obtener del caché primero
    const cacheKey = cacheService.generateKey(CACHE_KEYS.FILTERS, 'options');
    const cachedOptions = await cacheService.get<FilterOptions>(cacheKey);
    if (cachedOptions) {
      logger.info('Cache hit para opciones de filtros');
      return cachedOptions;
    }
    const [locations, attributeGroups, priceRange] = await Promise.all([
      // Obtener ubicaciones únicas
      Profile.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            countries: { $addToSet: '$location.country' },
            departments: { $addToSet: '$location.department' },
            cities: { $addToSet: '$location.city' },
          },
        },
      ]),

      // Obtener grupos de atributos
      AttributeGroup.find(),

      // Obtener rango de precios
      Profile.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $unwind: '$rates' },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$rates.price' },
            maxPrice: { $max: '$rates.price' },
          },
        },
      ]),
    ]);

    // Obtener categorías desde el grupo de atributos 'category'
    const categoryGroup = attributeGroups.find(
      (group) => group.key === 'category',
    );
    const categories = categoryGroup
      ? categoryGroup.variants
        .filter((variant: any) => variant.active)
        .map((variant: any) => ({
          label: variant.label || variant.value, // Compatibilidad con datos antiguos
          value: variant.value,
        }))
      : [];

    // Procesar features de attribute groups
    const features: { [groupKey: string]: any[] } = {};
    attributeGroups.forEach((group) => {
      features[group.key] = group.variants
        .filter((variant: any) => variant.active)
        .map((variant: any) => ({
          label: variant.label || variant.value, // Compatibilidad con datos antiguos
          value: variant.value,
        }));
    });

    const result = {
      categories: categoryGroup
        ? categoryGroup.variants
          .filter((variant: any) => variant.active)
          .map((variant: any) => ({
            label: variant.label || variant.value, // Compatibilidad con datos antiguos
            value: variant.value,
          }))
          .filter(Boolean)
        : [],
      locations: {
        countries: (locations[0]?.countries || []).filter(Boolean),
        departments: (locations[0]?.departments || []).filter(Boolean),
        cities: (locations[0]?.cities || []).filter(Boolean),
      },
      features,
      priceRange: {
        min: priceRange[0]?.minPrice || 0,
        max: priceRange[0]?.maxPrice || 0,
      },
    };

    // Guardar en caché por 30 minutos (las opciones cambian poco)
    await cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    logger.info('Opciones de filtros guardadas en caché');

    return result;
  } catch (error) {
    // Error in getFilterOptions
    throw error;
  }
};
