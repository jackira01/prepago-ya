import type {
  ProfileCardData,
} from '@/types/profile.types';
import type { Profile } from '@/types/user.types';

/**
 * Transforma un perfil de la API al formato esperado por las cards
 */
export const transformProfileToCard = (profile: Profile): ProfileCardData => {
  // CASTING CRÍTICO: Convertimos a 'any' porque la interfaz Profile actual
  // no tiene definida la propiedad 'verification', causando errores de TS.
  const p = profile as any;

  // Verificar si tiene videos
  const checkHasVideo = (media: { gallery: string[]; videos: { link: string; preview: string; }[]; profilePicture: string; }): boolean => {
    return (media.videos?.length || 0) > 0;
  };

  // CORRECCIÓN DEL BUG: Extraer la verificación real del backend
  // Si no existe, usamos un fallback, pero NO sobrescribimos si existe.
  const verificationData = p.verification || {
    _id: '',
    isVerified: false,
    verificationStatus: 'pending',
    verificationProgress: 0,
    verificationLevel: 0
  };

  return {
    _id: p._id,
    user: p.user, // Aseguramos pasar el ID de usuario si existe
    name: p.name,
    age: parseInt(p.age) || 0,
    location: p.location,
    description: p.description || '',
    media: {
      gallery: p.media.gallery || [],
      videos: p.media.videos?.map((v: any) => ({ link: v.link, type: 'video' as const })) || [],
      audios: [],
      stories: []
    },
    // AQUÍ ESTABA EL ERROR: Ahora pasamos la data real
    verification: verificationData,

    // Mapeo de otros campos
    featured: false,
    online: p.online || false,
    hasVideo: checkHasVideo(p.media),

    // Mapeo de upgrades usando las funciones auxiliares o propiedades directas
    hasDestacadoUpgrade: hasDestacadoUpgrade(p),
    hasImpulsoUpgrade: hasImpulsoUpgrade(p),

    // Campos adicionales requeridos por ProfileCardData
    slug: p.slug || p._id,
    category: p.category,
    planAssignment: p.planAssignment,
    price: p.price || { amount: 0, currency: 'COP' },
    services: p.services || []
  };
};

/**
 * Transforma una lista de perfiles de la API al formato esperado por las cards
 */
export const transformProfilesToCards = (
  profiles: Profile[],
): ProfileCardData[] => {
  if (!profiles || !Array.isArray(profiles)) {
    return [];
  }
  return profiles.map(transformProfileToCard);
};

/**
 * Formatea la ubicación para mostrar en las cards
 */
export const formatLocation = (location: {
  department?: { value: string; label: string } | string | null;
  city?: { value: string; label: string } | string | null;
} | null | undefined): string => {
  if (!location) return '';
  const departmentLabel = typeof location.department === 'object' && location.department ? location.department.label : (location.department as string | null | undefined);
  const cityLabel = typeof location.city === 'object' && location.city ? location.city.label : (location.city as string | null | undefined);

  if (!cityLabel && !departmentLabel) return '';

  // Para Bogotá mostrar: departamento, ciudad
  if (departmentLabel && departmentLabel.toLowerCase().includes('bogot')) {
    return cityLabel ? `${departmentLabel}, ${cityLabel}` : departmentLabel;
  }

  // Para otros departamentos: solo la ciudad
  return cityLabel || departmentLabel || '';
};

/**
 * Verifica si un perfil está verificado
 */
export const isProfileVerified = (profile: Profile): boolean => {
  const p = profile as any;
  // Ahora leemos la propiedad real
  return p.verification?.isVerified || false;
};

/**
 * Obtiene la primera imagen de un perfil
 */
export const getProfileImage = (profile: Profile): string => {
  return profile.media?.profilePicture || profile.media?.gallery?.[0] || '/placeholder.svg';
};

/**
 * Verifica si un perfil tiene videos
 */
export const hasProfileVideo = (profile: Profile): boolean => {
  return (profile.media?.videos?.length || 0) > 0;
};

/**
 * Verifica si un perfil tiene el upgrade "DESTACADO" activo
 */
export const hasDestacadoUpgrade = (profile: Profile): boolean => {
  const p = profile as any;

  // 1. Revisar flag directo si existe
  if (p.hasDestacadoUpgrade === true) return true;

  // 2. Verificar en upgrades activos
  if (p.activeUpgrades && Array.isArray(p.activeUpgrades)) {
    return p.activeUpgrades.some((upgrade: { code: string; startAt: Date; endAt: Date }) => upgrade.code === 'DESTACADO');
  }

  return false;
};

/**
 * Verifica si un perfil tiene el upgrade "IMPULSO" activo
 */
export const hasImpulsoUpgrade = (profile: Profile): boolean => {
  const p = profile as any;

  // 1. Revisar flag directo si existe
  if (p.hasImpulsoUpgrade === true) return true;

  // 2. Verificar en upgrades activos
  if (p.activeUpgrades && Array.isArray(p.activeUpgrades)) {
    return p.activeUpgrades.some((upgrade: { code: string; startAt: Date; endAt: Date }) => upgrade.code === 'IMPULSO');
  }

  return false;
};