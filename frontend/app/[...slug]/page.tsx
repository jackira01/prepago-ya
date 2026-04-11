import { API_URL, PAGINATION } from '@/lib/config';
import { locationService } from '@/services/location.service';
import type { ProfilesResponse } from '@/types/profile.types';
import { Metadata } from 'next';
import SearchPageClient from './SearchPageClient';

// Función helper para convertir slug a texto legible (solo para metadata)
const slugToReadable = (slug: string): string => {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bEscort\b/g, 'Scort');
};

// Forzar renderizado dinámico para evitar DYNAMIC_SERVER_USAGE
export const dynamic = 'force-dynamic';
// Permitir rutas dinámicas que no estén pre-generadas
export const dynamicParams = true;

interface SearchPageProps {
  params: Promise<{
    slug: string[];
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Función para obtener opciones de filtros de la API
async function getFilterOptions() {
  try {
    // Durante el build, evitar llamadas a la API
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
      return null;
    }

    const res = await fetch(`${API_URL}/api/filters/options`, {
      next: { revalidate: 300 } // Cache por 5 minutos
    });
    if (!res.ok) throw new Error('Failed to fetch filter options');
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return null;
  }
}

// Función para validar si una categoría es válida usando la API
async function isValidCategory(categoria: string): Promise<boolean> {
  try {
    const options = await getFilterOptions();
    if (!options) return true; // Durante build, permitir todas las categorías
    return options.categories.some((cat: any) => cat.value === categoria);
  } catch (error) {
    console.error('Error validating category:', error);
    return true; // Durante build, permitir todas las categorías
  }
}

// Prefijos de rutas del sistema que no deben ser procesadas como slugs de búsqueda
const SYSTEM_PATH_PREFIXES = ['.well-known', '_next', 'favicon', 'robots', 'sitemap'];

// Función para validar si un departamento es válido usando el backend
async function isValidDepartment(departamento: string): Promise<boolean> {
  try {
    // Ignorar rutas del sistema
    if (SYSTEM_PATH_PREFIXES.some(prefix => departamento.startsWith(prefix))) {
      return false;
    }

    // Durante build, permitir todos los departamentos
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
      return true;
    }

    // Validar contra el backend
    return await locationService.isValidDepartment(departamento);
  } catch (error) {
    return true; // Durante errores, permitir el departamento
  }
}

// Función para validar si una ciudad es válida usando el backend
async function isValidCity(ciudad: string, departamento?: string): Promise<boolean> {
  try {
    // Durante build, permitir todas las ciudades
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
      return true;
    }

    // Si tenemos el departamento, validar contra el backend
    if (departamento) {
      const isValid = await locationService.isValidCity(departamento, ciudad);
      return isValid;
    }

    // Si no hay departamento, no podemos validar la ciudad
    return true;
  } catch (error) {
    console.error('Error validating city:', error);
    return true; // Durante errores, permitir la ciudad
  }
}

// Generar metadata dinámico para SEO
export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const queryParams = await searchParams;

  let categoria: string;
  let departamento: string | undefined;
  let ciudad: string | undefined;

  if (slug && slug.length > 0) {
    // CASO 1: /filtros (sin categoría)
    if (slug[0] === 'filtros' && slug.length === 1) {
      categoria = '';
      departamento = queryParams.departamento as string | undefined;
      ciudad = queryParams.ciudad as string | undefined;
    }
    // CASO 2: /filtros/categoria?departamento=X&ciudad=Y
    else if (slug[0] === 'filtros' && slug.length > 1) {
      categoria = slug[1];
      departamento = queryParams.departamento as string | undefined;
      ciudad = queryParams.ciudad as string | undefined;
    }
    // CASO 3: Verificar si el primer segmento es un departamento
    else if (slug.length >= 1) {
      const isFirstSegmentDepartment = await isValidDepartment(slug[0]);

      if (isFirstSegmentDepartment) {
        categoria = '';
        departamento = slug[0];
        ciudad = slug.length >= 2 ? slug[1] : undefined;
      }
      // CASO 4: /categoria/departamento/ciudad
      else if (slug.length === 3) {
        [categoria, departamento, ciudad] = slug;
      }
      // CASO 5: /categoria/departamento
      else if (slug.length === 2) {
        [categoria, departamento] = slug;
      }
      // CASO 6: /categoria
      else {
        categoria = slug[0];
        departamento = queryParams.departamento as string | undefined;
        ciudad = queryParams.ciudad as string | undefined;
      }
    }
  } else {
    categoria = '';
  }

  let pageTitle = '';
  let pageDescription = '';
  let keywords = '';

  // Caso: Solo ubicación (sin categoría)
  if (!categoria && departamento) {
    const deptLabel = slugToReadable(departamento);

    if (ciudad) {
      const cityLabel = slugToReadable(ciudad);
      pageTitle = `Perfiles en ${cityLabel}, ${deptLabel} - Todos los servicios`;
      pageDescription = `Descubre todos los perfiles profesionales en ${cityLabel}, ${deptLabel}. Verificados y actualizados.`;
      keywords = `${cityLabel}, ${deptLabel}, perfiles, servicios`;
    } else {
      pageTitle = `Perfiles en ${deptLabel} - Todos los servicios`;
      pageDescription = `Descubre todos los perfiles profesionales en ${deptLabel}. Verificados y actualizados.`;
      keywords = `${deptLabel}, perfiles, servicios`;
    }
  }
  // Caso: Categoría con/sin ubicación
  else if (categoria) {
    // Validar categoría
    if (!(await isValidCategory(categoria))) {
      return {
        title: 'PrepagoYa - Premium Scort Services',
        description: 'Find premium scort services in your city. Professional, verified, and discreet companions.',
      };
    }

    if (ciudad && departamento) {
      const deptLabel = slugToReadable(departamento);
      const cityLabel = slugToReadable(ciudad);
      pageTitle = `${slugToReadable(categoria)} en ${cityLabel}, ${deptLabel} - Perfiles Verificados`;
      pageDescription = `Encuentra los mejores perfiles de ${categoria} en ${cityLabel}, ${deptLabel}. Perfiles verificados y actualizados.`;
      keywords = `${categoria}, ${cityLabel}, ${deptLabel}, perfiles, verificados`;
    } else if (departamento) {
      const deptLabel = slugToReadable(departamento);
      pageTitle = `${slugToReadable(categoria)} en ${deptLabel} - Perfiles Verificados`;
      pageDescription = `Encuentra los mejores perfiles de ${categoria} en ${deptLabel}. Perfiles verificados y actualizados.`;
      keywords = `${categoria}, ${deptLabel}, perfiles, verificados`;
    } else {
      pageTitle = `${slugToReadable(categoria)} - Perfiles Verificados`;
      pageDescription = `Encuentra los mejores perfiles de ${categoria}. Perfiles verificados y actualizados en toda Colombia.`;
      keywords = `${categoria}, perfiles, verificados, Colombia`;
    }
  }
  // Caso: Sin filtros
  else {
    pageTitle = 'PrepagoYa - Premium Scort Services';
    pageDescription = 'Find premium scort services in your city. Professional, verified, and discreet companions.';
    keywords = 'Escorts, services, verified, premium';
  }

  return {
    title: pageTitle,
    description: pageDescription,
    keywords,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
    },
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { slug } = await params;
  const queryParams = await searchParams;

  let categoria: string;
  let departamento: string | undefined;
  let ciudad: string | undefined;

  if (slug && slug.length > 0) {
    // CASO 1: /filtros (sin categoría, solo ubicación por query params)
    if (slug[0] === 'filtros' && slug.length === 1) {
      categoria = ''; // Sin categoría específica
      departamento = queryParams.departamento as string | undefined;
      ciudad = queryParams.ciudad as string | undefined;
    }
    // CASO 2: /filtros/categoria?departamento=X&ciudad=Y
    else if (slug[0] === 'filtros' && slug.length > 1) {
      categoria = slug[1];
      departamento = queryParams.departamento as string | undefined;
      ciudad = queryParams.ciudad as string | undefined;
    }
    // CASO 3: Un solo segmento - /categoria o /departamento
    // Prioridad: PRIMERO validar categoría, LUEGO departamento
    else if (slug.length === 1) {
      const isCategory = await isValidCategory(slug[0]);

      if (isCategory) {
        // Es una categoría
        categoria = slug[0];
        departamento = queryParams.departamento as string | undefined;
        ciudad = queryParams.ciudad as string | undefined;
      } else {
        // Si no es categoría, verificar si es departamento
        const isDepartment = await isValidDepartment(slug[0]);

        if (isDepartment) {
          // Es un departamento sin categoría
          categoria = '';
          departamento = slug[0];
          ciudad = undefined;
        } else {
          // No es ni categoría ni departamento - tratar como categoría por defecto
          categoria = slug[0];
          departamento = queryParams.departamento as string | undefined;
          ciudad = queryParams.ciudad as string | undefined;
        }
      }
    }
    // CASO 4: Dos segmentos - /categoria/departamento o /departamento/ciudad
    else if (slug.length === 2) {
      // Verificar si el primero es categoría
      const isCategory = await isValidCategory(slug[0]);

      if (isCategory) {
        // /categoria/departamento
        [categoria, departamento] = slug;
        ciudad = undefined;
      } else {
        // /departamento/ciudad (sin categoría)
        categoria = '';
        departamento = slug[0];
        ciudad = slug[1];
      }
    }
    // CASO 5: Tres segmentos - /categoria/departamento/ciudad
    else if (slug.length === 3) {
      [categoria, departamento, ciudad] = slug;
    }
    // CASO 6: Más segmentos - tratar el primero como categoría
    else {
      categoria = slug[0];
      departamento = queryParams.departamento as string | undefined;
      ciudad = queryParams.ciudad as string | undefined;
    }
  } else {
    categoria = '';
  }

  // Verificar si es un archivo estático - renderizar contenido por defecto
  if (categoria && (
    categoria.includes('.') || // Archivos con extensión
    categoria.startsWith('_') || // Archivos del sistema Next.js
    categoria === 'favicon.ico' ||
    categoria === 'robots.txt' ||
    categoria === 'sitemap.xml' ||
    categoria.endsWith('.js') ||
    categoria.endsWith('.css') ||
    categoria.endsWith('.map') ||
    categoria.endsWith('.ico') ||
    categoria.endsWith('.png') ||
    categoria.endsWith('.jpg') ||
    categoria.endsWith('.svg')
  )) {
    // Renderizar página por defecto en lugar de notFound
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Página no encontrada</h1>
        <p>El recurso solicitado no está disponible.</p>
      </div>
    );
  }

  // Validaciones simplificadas sin verificaciones dinámicas
  // Permitir /filtros sin parámetros para mostrar todos los perfiles
  // Solo rechazar si no es /filtros Y no hay categoría ni departamento
  if (!categoria && !departamento && !(slug && slug[0] === 'filtros')) {
    // Missing both category and department parameter
    // Renderizar contenido por defecto en lugar de notFound
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Filtros requeridos</h1>
        <p>Por favor especifica una categoría o ubicación válida.</p>
      </div>
    );
  }

  // Validaciones de categoría, departamento y ciudad sin verificaciones dinámicas
  if (categoria) {
    const isValidCat = await isValidCategory(categoria);
    if (!isValidCat) {
      // Invalid category
    }
  }

  if (departamento) {
    const isValidDept = await isValidDepartment(departamento);
    if (!isValidDept) {
      // Invalid department
    }
  }

  if (ciudad) {
    const isValidCit = await isValidCity(ciudad, departamento);
    if (!isValidCit) {
      // Invalid city
    }
  }

  // Obtener datos del servidor con ISR
  let profilesData: ProfilesResponse;

  try {
    // Preparar el body para la petición POST
    const requestBody: any = {
      page: 1,
      limit: PAGINATION.DEFAULT_LIMIT,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      isActive: true
    };

    // IMPORTANTE: NO usar slugToText() - los slugs ya están en el formato correcto (minúsculas)
    // El backend espera valores exactos como están en la BD: "escort", "bogota", etc.
    if (categoria) {
      requestBody.category = categoria;
    }

    if (departamento) {
      requestBody.location = { department: departamento };
      if (ciudad) {
        requestBody.location.city = ciudad;
      }
    }

    // Fetch con revalidate para ISR usando POST
    const res = await fetch(
      `${API_URL}/api/filters/profiles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        next: { revalidate: 3600 } // 1 hora
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const responseData = await res.json();

    // Transformar la estructura para que coincida con ProfilesResponse
    if (responseData.success && responseData.data) {
      const backendData = responseData.data;

      profilesData = {
        profiles: backendData.profiles,
        pagination: {
          currentPage: backendData.currentPage,
          totalPages: backendData.totalPages,
          totalProfiles: backendData.totalCount,
          hasNextPage: backendData.hasNextPage,
          hasPrevPage: backendData.hasPrevPage,
        },
      };
    } else {
      throw new Error(responseData.message || 'Error en la respuesta del servidor');
    }
  } catch (error) {
    console.error('❌ [ERROR] Failed to fetch profiles for ISR:', error);

    // En caso de error, devolver datos vacíos para evitar crash
    profilesData = {
      profiles: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalProfiles: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  return (
    <SearchPageClient
      categoria={categoria}
      departamento={departamento}
      ciudad={ciudad}
      profilesData={profilesData}
    />
  );
}

// No pre-generar rutas en build time - se generarán on-demand
export async function generateStaticParams() {
  return [];
}

// Configurar revalidación para ISR (Incremental Static Regeneration)
// Las páginas se regenerarán cada hora cuando sean solicitadas
export const revalidate = 3600; // 1 hora