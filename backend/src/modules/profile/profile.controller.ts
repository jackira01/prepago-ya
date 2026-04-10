import type { Response } from 'express';
import { notifyN8nWebhook } from '../../services/n8n-webhook.service';
import type { AuthRequest } from '../../types/auth.types';
import { ConfigParameterService } from '../config-parameter/config-parameter.service';
import { UpgradeDefinitionModel } from '../plans/upgrade.model';
import UserModel from '../user/User.model';
import {
  BusinessValidationError,
  getUserUsageStats,
  validateAmatistaLimit,
  validatePaidPlanAssignment,
  validatePurchaseIdempotency,
  validateUpgradePurchase
} from '../validation/business-validation.service';
import { ProfileModel } from './profile.model';
import * as service from './profile.service';
import {
  createProfileWithInvoice,
  getActiveProfilesCount,
  getDeletedProfiles,
  hardDeleteProfile,
  hideProfile,
  purchaseUpgrade,
  restoreProfile,
  showProfile,
  softDeleteProfile,
  subscribeProfile
} from './profile.service';

export const createProfile = async (req: AuthRequest, res: Response) => {
  try {
    // Raw request body processing

    const { profileData, purchasedPlan } = req.body;

    // Destructured data processing

    // Validar que se proporcionen los datos del perfil
    if (!profileData) {
      return res.status(400).json({
        success: false,
        message: 'Los datos del perfil (profileData) son requeridos'
      });
    }

    // Datos recibidos para crear perfil

    // Extraer información del plan comprado si existe
    let planId = null;
    let planCode = null;
    let planDays = null;
    let generateInvoice = true; // Por defecto SÍ generar factura (para usuarios regulares)
    let couponCode = null; // Código de cupón si existe

    if (purchasedPlan) {
      planId = purchasedPlan.planId; // ID del plan (nuevo campo prioritario)
      planCode = purchasedPlan.planCode; // Código del plan (mantener para compatibilidad)
      planDays = purchasedPlan.planDays || purchasedPlan.variantDays;
      couponCode = purchasedPlan.couponCode || null; // Extraer código de cupón

      // IMPORTANTE: Solo usar el valor del frontend si es un admin explícitamente
      // Si purchasedPlan.generateInvoice es undefined, mantener el default (true)
      // Si purchasedPlan.generateInvoice existe (admin), usar ese valor
      if (purchasedPlan.hasOwnProperty('generateInvoice')) {
        generateInvoice = purchasedPlan.generateInvoice;
      }
      // Para usuarios regulares, generateInvoice queda en true (default)

      // Validar que el plan comprado tenga los datos necesarios (ID o Código)
      if ((!planId && !planCode) || !planDays) {
        return res.status(400).json({
          success: false,
          message: 'El plan comprado debe incluir planId (o planCode) y planDays/variantDays'
        });
      }

      // Obtener configuración del plan por defecto
      const defaultPlanConfig = await ConfigParameterService.findByKey('system.default_plan');
      const defaultPlanCode = defaultPlanConfig?.value?.enabled && defaultPlanConfig?.value?.planCode
        ? defaultPlanConfig.value.planCode
        : 'AMATISTA'; // Fallback

      // Validar límite total de perfiles (defensa en profundidad)
      const maxProfilesValidation = await service.validateMaxProfiles(profileData.userId || profileData.user);
      if (!maxProfilesValidation.ok) {
        return res.status(403).json({
          success: false,
          message: maxProfilesValidation.message || 'Has alcanzado el límite máximo de perfiles',
          currentCount: maxProfilesValidation.currentCount,
          maxAllowed: maxProfilesValidation.maxAllowed
        });
      }

      // Si se especifica un plan pago, validar límites de plan específico (ej: AMATISTA)
      if (planCode !== 'GRATIS' && planCode !== defaultPlanCode) {
        // Validando plan de pago
        // Solo validar idempotencia y límites específicos del plan (no límite general de 10 perfiles)
        if (purchasedPlan.orderId) {
          await validatePurchaseIdempotency(
            profileData.userId || profileData.user,
            purchasedPlan.orderId,
            'plan'
          );
        }

        // Validación específica para AMATISTA (límite de 3 perfiles visibles)
        if (planCode === 'AMATISTA') {
          await validateAmatistaLimit(profileData.userId || profileData.user, undefined);
        }
        // Validación de plan completada
      }
    }

    // Usar la nueva función que maneja facturación automática
    const result = await createProfileWithInvoice({
      ...profileData,
      planId: planId,
      planCode: planCode,
      planDays: planDays,
      generateInvoice: generateInvoice, // Pasar el campo generateInvoice
      couponCode: couponCode // Pasar el código del cupón
    });

    // Verificar que el perfil fue creado correctamente
    if (!result.profile) {
      throw new Error('Error interno: No se pudo crear el perfil');
    }

    // Notificar flujo de creación de perfil a n8n
    let webhookUserEmail: string | undefined;
    try {
      const userDoc = await UserModel.findById(result.profile.user).select('email').lean() as any;
      webhookUserEmail = userDoc?.email;
    } catch { /* no interrumpir flujo principal */ }

    notifyN8nWebhook({
      flow: 'profile_created',
      email: webhookUserEmail,
      name: result.profile.name,
      createdAt: (result.profile as any).createdAt ?? new Date(),
    });

    // Respuesta diferenciada según si se generó factura
    if (result.invoice) {
      // Perfil creado con factura pendiente
      res.status(201).json({
        success: true,
        message: 'Perfil creado exitosamente. Se ha generado una factura pendiente.',
        profile: {
          _id: result.profile._id,
          name: result.profile.name
        },
        invoice: {
          _id: result.invoice._id,
          invoiceNumber: result.invoice.invoiceNumber,
          totalAmount: result.invoice.totalAmount,
          expiresAt: result.invoice.expiresAt,
          status: result.invoice.status
        },
        whatsAppMessage: result.whatsAppMessage,
        paymentRequired: true
      });
    } else {
      // Perfil creado sin factura (plan gratuito)
      res.status(201).json({
        success: true,
        message: 'Perfil creado exitosamente.',
        profile: {
          _id: result.profile._id,
          name: result.profile.name
        },
        whatsAppMessage: result.whatsAppMessage,
        paymentRequired: false
      });
    }
  } catch (err: unknown) {
    console.error('❌ Error creating profile:', err);
    if (req.body) {
      console.error('📦 Request body (partial):', JSON.stringify({
        keys: Object.keys(req.body),
        profileDataKeys: req.body.profileData ? Object.keys(req.body.profileData) : 'missing'
      }, null, 2));
    }

    // Manejar errores de validación de negocio
    if (err instanceof BusinessValidationError) {
      return res.status(409).json({ message: err.message });
    }

    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};

/**
 * Ocultar perfil visualmente (para usuarios normales)
 */
export const hideProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const result = await hideProfile(profileId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Borrado lógico de perfil (para administradores)
 */
export const softDeleteProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const result = await softDeleteProfile(profileId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Mostrar perfil oculto (para usuarios normales)
 */
export const showProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const result = await showProfile(profileId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Eliminación lógica de perfil (para usuarios normales - solo sus propios perfiles)
 */
export const userSoftDeleteProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const result = await softDeleteProfile(profileId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Borrado físico de perfil (para administradores)
 */
export const hardDeleteProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;

    // Verificar que el usuario sea administrador
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden eliminar perfiles permanentemente'
      });
    }

    const result = await hardDeleteProfile(profileId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Restaurar perfil (reactivar después de borrado lógico)
 */
export const restoreProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const result = await restoreProfile(profileId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener perfiles eliminados lógicamente (para administradores)
 */
export const getDeletedProfilesController = async (req: AuthRequest, res: Response) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden ver perfiles eliminados'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await getDeletedProfiles(page, limit);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

export const getProfiles = async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const fields = req.query.fields as string;

  const profiles = await service.getProfiles(page, limit, fields);
  res.json(profiles);
};

export const getProfilesForHome = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const profiles = await service.getProfilesForHome(page, limit);
    res.json(profiles);
  } catch (error: any) {
    console.error('Error getting profiles for home:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Obtener todos los perfiles para el adminboard (incluye activos e inactivos)
 */
export const getAllProfilesForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden ver todos los perfiles'
      });
    }

    // Recibir parámetros del body en lugar de query params
    const { page = 1, limit = 10, fields, userId, profileName, profileId, isActive, isDeleted, isVerified } = req.body;

    console.log('📋 [ADMIN] Solicitando perfiles:', { page, limit, userId, profileName, profileId, isActive, isDeleted, isVerified, fieldsCount: fields?.length || 0 });

    const result = await service.getAllProfilesForAdmin(page, limit, fields, userId, profileName, profileId, isActive, isDeleted, isVerified);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error getting all profiles for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

export const getProfileById = async (req: AuthRequest, res: Response) => {
  const profile = await service.getProfileById(req.params.id);
  if (!profile)
    return res.status(404).json({ message: 'Perfil no encontrado' });
  res.json(profile);
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  // Prevenir que se cambie el campo 'user' (auditoría)
  // El perfil siempre debe mantener su propietario original
  const { user, ...safeData } = req.body;

  const updated = await service.updateProfile(req.params.id, safeData);
  res.json(updated);
};

export const deleteProfile = async (req: AuthRequest, res: Response) => {
  await service.deleteProfile(req.params.id);
  res.status(204).send();
};

// Nuevos endpoints para suscripción y upgrades
export const subscribeProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { planCode, variantDays, orderId } = req.body;

    if (!planCode || !variantDays) {
      return res.status(400).json({ error: 'planCode y variantDays son requeridos' });
    }

    // Obtener el perfil para validaciones
    const profile = await service.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Validaciones de negocio
    await validatePaidPlanAssignment(
      profile.user.toString(),
      planCode,
      id,
      orderId
    );

    const updatedProfile = await subscribeProfile(id, planCode, variantDays);
    res.status(200).json(updatedProfile);
  } catch (error: any) {
    console.error('Error subscribing profile:', error);

    // Manejar errores de validación de negocio
    if (error instanceof BusinessValidationError) {
      return res.status(409).json({ error: error.message });
    }

    if (error.message.includes('no encontrado') || error.message.includes('no encontrada')) {
      return res.status(404).json({ error: error.message });
    }

    if (error.message.includes('Máximo')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const purchaseUpgradeController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { code, orderId, generateInvoice } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code es requerido' });
    }

    // Obtener el perfil para validaciones
    const profile = await service.getProfileById(id);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Validar que el perfil tenga un plan asignado y vigente
    const now = new Date();
    if (!profile.planAssignment) {
      return res.status(400).json({ error: 'Debes tener un plan activo para comprar mejoras.' });
    }

    // Check if plan is expired
    const expiresAt = new Date(profile.planAssignment.expiresAt);
    if (expiresAt <= now) {
      return res.status(400).json({ error: 'Tu plan ha expirado. Renueva para comprar mejoras.' });
    }

    // Verificar si el usuario es admin
    const user = req.user;
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    // Determinar si debe generar factura (por defecto true, excepto si admin envía false explícitamente)
    const shouldGenerateInvoice = generateInvoice !== false;

    // Si es admin y no quiere generar factura, activar directamente el upgrade
    if (isAdmin && !shouldGenerateInvoice) {
      // Obtener el perfil como documento de Mongoose para poder usar .save()
      const profileDoc = await ProfileModel.findById(id);
      if (!profileDoc) {
        return res.status(404).json({ error: 'Perfil no encontrado' });
      }

      // Activar upgrade directamente sin factura (lógica para admin)
      const upgrade = await UpgradeDefinitionModel.findOne({ code });
      if (!upgrade) {
        return res.status(404).json({ error: `Upgrade ${code} no encontrado` });
      }

      const endAt = new Date(now.getTime() + (upgrade.durationHours * 60 * 60 * 1000));

      // Limpiar upgrades expirados y duplicados antes de agregar
      const upgradeMap = new Map<string, any>();
      for (const existingUpgrade of profileDoc.upgrades) {
        // Saltar upgrades expirados
        if (existingUpgrade.endAt <= now) {
          continue;
        }
        const existing = upgradeMap.get(existingUpgrade.code);
        // Mantener solo el más reciente de cada tipo
        if (!existing || existingUpgrade.purchaseAt > existing.purchaseAt) {
          upgradeMap.set(existingUpgrade.code, existingUpgrade);
        }
      }
      profileDoc.upgrades = Array.from(upgradeMap.values());

      // Buscar si ya existe upgrade del mismo tipo (después de limpiar)
      const existingUpgradeIndex = profileDoc.upgrades.findIndex(
        u => u.code === code
      );

      if (existingUpgradeIndex !== -1) {
        // Reemplazar el upgrade existente
        profileDoc.upgrades[existingUpgradeIndex] = {
          code,
          startAt: now,
          endAt,
          purchaseAt: now
        } as any;
      } else {
        // Agregar nuevo upgrade
        profileDoc.upgrades.push({
          code,
          startAt: now,
          endAt,
          purchaseAt: now
        } as any);
      }

      await profileDoc.save();

      return res.status(200).json({
        success: true,
        message: `Upgrade ${code} activado exitosamente`,
        profile: profileDoc,
        paymentRequired: false
      });
    }

    // Flujo normal: generar factura
    // Validaciones de negocio
    await validateUpgradePurchase(
      profile.user._id.toString(),
      id,
      code,
      orderId
    );

    const result = await purchaseUpgrade(id, code, profile.user._id.toString());

    // Retornar respuesta con datos de WhatsApp si están disponibles
    res.status(200).json({
      profile: result.profile,
      invoice: result.invoice,
      upgradeCode: result.upgradeCode,
      status: result.status,
      message: result.message,
      whatsAppMessage: result.whatsAppMessage,
      paymentRequired: true
    });
  } catch (error: any) {
    console.error('Error purchasing upgrade:', error);

    // Manejar errores de validación de negocio
    if (error instanceof BusinessValidationError) {
      return res.status(409).json({ error: error.message });
    }

    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ error: error.message });
    }

    if ((error as any).status === 409 || error.message.includes('ya activo') || error.message.includes('sin un plan activo')) {
      return res.status(409).json({ error: error.message });
    }

    if (error.message.includes('requeridos no activos')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfilesPost = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, fields } = req.body;

    // Convertir a números para asegurar tipos correctos
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const profiles = await service.getProfiles(pageNum, limitNum, fields);
    res.json(profiles);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};

export const verifyProfileName = async (req: AuthRequest, res: Response) => {
  try {
    // Debug: req.query
    const { profileName } = req.query;
    const profile = await service.checkProfileNameExists(profileName as string);
    res.status(200).send(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};

export const createMissingVerifications = async (req: AuthRequest, res: Response) => {
  try {
    const result = await service.createMissingVerifications();
    res.status(200).json({
      success: true,
      message: `Proceso completado. ${result.created} verificaciones creadas, ${result.errors} errores.`,
      data: result
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({
      success: false,
      message: `Error al crear verificaciones faltantes: ${message}`
    });
  }
};

export const getProfilesWithStories = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const profiles = await service.getProfilesWithStories(page, limit);
    res.json(profiles);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({ message });
  }
};

// Endpoint para obtener estadísticas de uso del usuario (debugging)
export const getUserUsageStatsController = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const stats = await getUserUsageStats(userId);
    res.json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({ message });
  }
};

// Endpoint para validar límites de perfiles de un usuario
export const validateUserProfileLimitsController = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { planCode } = req.query;

    const validation = await service.validateUserProfileLimits(userId, planCode as string);
    res.json(validation);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({ message });
  }
};

// Endpoint para obtener resumen de perfiles de un usuario
export const getUserProfilesSummaryController = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const summary = await service.getUserProfilesSummary(userId);
    res.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({ message });
  }
};

// Endpoint para validar upgrade de plan de un perfil
export const getProfilePlanInfoController = async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;

    const profile = await service.getProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Si no tiene plan asignado, devolver info indicando que no tiene plan
    if (!profile.planAssignment) {
      return res.status(200).json({
        planCode: null,
        variantDays: null,
        startAt: null,
        expiresAt: null,
        isActive: false,
        daysRemaining: 0,
        hasNoPlan: true // Indicador útil para el frontend
      });
    }

    const now = new Date();
    const expiresAt = new Date(profile.planAssignment.expiresAt);
    const isActive = expiresAt > now;

    // Calcular días restantes (puede ser negativo si está expirado)
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Devolver información del plan (activo o expirado)
    const planInfo = {
      planCode: profile.planAssignment.planCode,
      variantDays: profile.planAssignment.variantDays,
      startAt: profile.planAssignment.startAt,
      expiresAt: profile.planAssignment.expiresAt,
      isActive,
      daysRemaining,
      hasNoPlan: false
    };

    // Plan info devuelto
    res.json(planInfo);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    // Error en getProfilePlanInfo
    res.status(400).json({ message });
  }
};

export const validateProfilePlanUpgradeController = async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const { planCode } = req.query;

    if (!planCode) {
      return res.status(400).json({ error: 'planCode es requerido' });
    }

    const validation = await service.validateProfilePlanUpgrade(profileId, planCode as string);
    res.json(validation);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};

// Endpoint para validar compra de upgrade
export const validateUpgradePurchaseController = async (req: AuthRequest, res: Response) => {
  try {
    const { profileId, upgradeCode } = req.params;

    if (!upgradeCode) {
      return res.status(400).json({ error: 'upgradeCode es requerido' });
    }

    const profile = await service.getProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Verificar que el perfil tiene un plan activo
    const now = new Date();
    const hasActivePlan = profile.planAssignment &&
      new Date(profile.planAssignment.expiresAt) > now;

    if (!hasActivePlan) {
      return res.json({
        canPurchase: false,
        reason: 'Necesitas un plan activo para comprar upgrades'
      });
    }

    // Verificar reglas específicas por tipo de upgrade
    if (upgradeCode === 'IMPULSO') {
      // IMPULSO requiere DESTACADO activo
      const activeUpgrades = profile.upgrades?.filter(u => new Date(u.endAt) > now) || [];
      const hasDestacado = activeUpgrades.some(u => u.code === 'DESTACADO');

      if (!hasDestacado) {
        return res.json({
          canPurchase: false,
          reason: 'Necesitas tener "Destacado" activo para comprar "Impulso"'
        });
      }
    }

    // Verificar si es plan DIAMANTE y el upgrade es DESTACADO
    if (upgradeCode === 'DESTACADO' && profile.planAssignment?.planCode === 'DIAMANTE') {
      return res.json({
        canPurchase: false,
        reason: 'El plan Diamante ya incluye "Destacado" permanente'
      });
    }

    // Verificar si ya tiene el upgrade activo
    const activeUpgrades = profile.upgrades?.filter(u => new Date(u.endAt) > now) || [];
    const hasUpgradeActive = activeUpgrades.some(u => u.code === upgradeCode);

    if (hasUpgradeActive) {
      return res.json({
        canPurchase: false,
        reason: `El upgrade ${upgradeCode} ya está activo`
      });
    }

    res.json({ canPurchase: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({ message });
  }
};

export const validatePlanOperationsController = async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;

    if (!profileId) {
      res.status(400).json({ message: 'profileId es requerido' });
      return;
    }

    // Obtener el perfil
    const profile = await service.getProfileById(profileId);
    if (!profile) {
      res.status(404).json({ message: 'Perfil no encontrado' });
      return;
    }

    // Obtener el conteo de perfiles activos del usuario
    const activeProfilesCount = await getActiveProfilesCount(profile.user.toString());

    // Validaciones básicas
    const maxActiveProfiles = 10; // Límite estándar
    const canPurchase = activeProfilesCount < maxActiveProfiles;
    const canUpgrade = true; // Los upgrades generalmente están permitidos
    const canRenew = profile.planAssignment && new Date(profile.planAssignment.expiresAt) > new Date();

    let reason = '';
    if (!canPurchase) {
      reason = `Has alcanzado el límite máximo de ${maxActiveProfiles} perfiles con plan activo`;
    }

    res.json({
      canPurchase,
      canUpgrade,
      canRenew,
      activeProfilesCount,
      maxActiveProfiles,
      reason
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(500).json({ message });
  }
};

// Endpoint para hacer upgrade de plan de un perfil
export const upgradePlanController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params; // Usar 'id' en lugar de 'profileId' para coincidir con la ruta
    const { newPlanCode, variantDays } = req.body;

    // Backend Controller: Upgrade request received

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'profileId es requerido'
      });
    }

    if (!newPlanCode) {
      return res.status(400).json({
        success: false,
        error: 'newPlanCode es requerido'
      });
    }

    const updatedProfile = await service.upgradePlan(profileId, newPlanCode, variantDays);

    // Backend Controller: Upgrade successful

    res.json({
      success: true,
      message: 'Plan actualizado exitosamente',
      profile: updatedProfile
    });
  } catch (error: any) {
    // Backend Controller: Error al hacer upgrade de plan
    res.status(400).json({
      success: false,
      error: error.message || 'Error al hacer upgrade del plan'
    });
  }
};

/**
 * VALIDACIÓN A: Verifica si el usuario puede crear un nuevo perfil (límite total)
 * Se ejecuta ANTES de entrar al wizard de creación
 * GET /api/profile/validate-max
 */
export const validateMaxProfilesController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado'
      });
    }

    const result = await service.validateMaxProfiles(userId);

    return res.status(result.ok ? 200 : 403).json(result);
  } catch (error: any) {
    console.error('Error en validateMaxProfilesController:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al validar límite de perfiles'
    });
  }
};

/**
 * VALIDACIÓN B: Verifica si el usuario puede seleccionar un plan gratuito
 * Se ejecuta en el PASO 4 del wizard cuando selecciona un plan
 * POST /api/profile/validate-plan-selection
 * Body: { planCode: string }
 */
export const validatePlanSelectionController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planCode } = req.body;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!planCode) {
      return res.status(400).json({
        ok: false,
        message: 'planCode es requerido'
      });
    }

    const result = await service.validatePlanSelection(userId, planCode);

    return res.status(result.ok ? 200 : 403).json(result);
  } catch (error: any) {
    console.error('Error en validatePlanSelectionController:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al validar selección de plan'
    });
  }
};

export const addStoryController = async (req: AuthRequest, res: Response) => {
  try {
    const { id: profileId } = req.params;
    const { link, type, duration, startTime } = req.body;

    if (!link || !type) {
      return res.status(400).json({ message: 'Link and type are required' });
    }

    const updatedProfile = await service.addStory(profileId, { link, type, duration, startTime });
    res.json(updatedProfile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};

export const checkStoryLimitsController = async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const limits = await service.checkStoryLimits(profileId);
    res.json(limits);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};

export const deleteAllStoriesController = async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const updatedProfile = await service.deleteAllStories(profileId);
    res.json(updatedProfile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    res.status(400).json({ message });
  }
};