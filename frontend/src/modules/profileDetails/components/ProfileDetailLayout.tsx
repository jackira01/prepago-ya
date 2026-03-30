'use client';

import Loader from '@/components/Loader';
import { useProfile } from '@/hooks/use-profile';
import { useProfileVerification } from '@/hooks/use-profile-verification';
import { ProfileGallery } from '@/modules/profileDetails/components/GaleryProfile';
import { createProfileSlug } from '@/utils/slug';
import { useSession } from 'next-auth/react';

import { AccountTypeSection } from './AccountTypeSection';
import AudioPlayer from './AudioPlayer';
import AvailabilityProfile from './AvailabilityProfile';
import { DescriptionProfile } from './DescriptionProfile';
import PhysicalTraitsProfile from './PhysicalTraitsProfile';
import ProfielHeader from './ProfileHeader';
import RatesProfile from './RatesProfile';
import { ShareProfile } from './ShareProfile';
import { SocialMediaProfile } from './SocialMediaProfile';
import { VerificationStatus } from './VerificationStatus';
import VideoPlayer from './VideoPlayer';

export default function ProfileDetailLayout({ id }: { id: string }) {
  const { data: session } = useSession();
  const { data: profile, isLoading, error } = useProfile(id);
  const { data: verification } = useProfileVerification(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Loader />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Perfil no encontrado
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            El perfil que buscas no existe o ha sido eliminado.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = session?.user?.role === 'admin';
  const isOwner = session?.user?.id === profile.user?._id;
  const isVisible = profile.visible;

  if (!isVisible && !isAdmin && !isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Perfil no disponible
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Este perfil no está disponible públicamente.
          </p>
        </div>
      </div>
    );
  }

  const adaptedProfileData = {
    id: profile._id,
    name: profile.name,
    age: parseInt(profile.age),
    location: `${profile.location?.country?.label || profile.location?.country || ''}, ${profile.location?.department?.label || profile.location?.department || ''}, ${profile.location?.city?.label || profile.location?.city || ''}`
      .replace(/^,\s*|,\s*$/g, '')
      .replace(/,\s*,/g, ','),
    category: (() => {
      const cat = profile.features?.find((feature: any) => feature.groupName === 'Categoría');
      if (!cat) return 'SCORT';
      const v = Array.isArray(cat.value) ? cat.value[0] : cat.value;
      if (v && typeof v === 'object' && 'label' in v) return (v as any).label;
      return v || 'SCORT';
    })(),
    verified: verification?.data?.steps?.selfieVerification?.isVerified || false,
    description: profile.description,
    images: profile.media?.gallery || ['/placeholder.svg?height=400&width=600'],
    videos: (() => {
      const vids = profile.media?.videos || [];
      const cover = (profile as any).coverImageIndex;
      const previewFallback =
        profile.media?.gallery?.length > 0
          ? (typeof cover === 'number' && profile.media.gallery[cover]) ||
          profile.media.gallery[0]
          : '/placeholder.svg';
      return vids.map((v: any) =>
        typeof v === 'string'
          ? { link: v, preview: previewFallback }
          : {
            link: v.link || '',
            preview:
              v.preview && v.preview.trim() !== ''
                ? v.preview
                : previewFallback,
          }
      );
    })(),
    services: profile.services || [],
    basicServices: profile.basicServices || [],
    additionalServices: profile.additionalServices || [],
    physicalTraits: {
      edad: profile.age?.toString() || '',
      ...Object.fromEntries(
        (profile.features || []).map((feature: any) => {
          const values: any[] = Array.isArray(feature.value)
            ? feature.value
            : [feature.value];
          const display = values
            .filter((v: any) => v != null)
            .map((v: any) =>
              typeof v === 'object' && 'label' in v ? v.label : v
            )
            .join(', ');
          return [
            feature.labelName?.toLowerCase() || feature.groupName,
            display,
          ];
        })
      ),
      ubicacion: `${profile.location?.department?.label || profile.location?.department || ''}, ${profile.location?.city?.label || profile.location?.city || ''}`
        .replace(/^,\s*|,\s*$/g, '')
        .replace(/,\s*,/g, ','),
      altura: profile.height ? `${profile.height} cm` : '',
    },
    rates: profile.rates || [],
    availability: profile.availability || {},
    contact: {
      number: profile.contact?.number || '',
      whatsapp: profile.contact?.whatsapp || false,
      telegram: profile.contact?.telegram || false,
    },
    socialMedia: {
      instagram: (profile.verification as any)?.steps?.socialMedia?.instagram || profile.socialMedia?.instagram || null,
      onlyfans: profile.socialMedia?.onlyFans || null,
      twitter: profile.socialMedia?.twitter || null,
      facebook: profile.socialMedia?.facebook || null,
      tiktok: profile.socialMedia?.tiktok || null,
    },
    accountType: (profile.user as any)?.accountType || 'common',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 transition-all duration-500">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-3 shadow-sm">
          <div className="shrink-0 pt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-rose-600 dark:text-rose-400">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-rose-800 dark:text-rose-200 leading-relaxed">
            <span className="font-bold">PrepagoYa</span> <span className="font-bold">NUNCA</span> interviene en la relaciones entre usuarios y <span className="font-bold">NUNCA</span> contacta para solicitar dinero o cualquier otro dato personal.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
          {/* === Contenido principal === */}
          <div className="lg:col-span-5 space-y-8">
            <ProfileGallery
              {...adaptedProfileData}
              isIdentityVerified={
                (verification?.data?.steps?.frontPhotoVerification?.isVerified || false) &&
                (verification?.data?.steps?.selfieVerification?.isVerified || false)
              }
            />

            {/* Header + redes sociales solo en mobile */}
            <div className="block lg:hidden space-y-4 px-0">
              <ProfielHeader
                name={adaptedProfileData.name}
                age={adaptedProfileData.age}
                category={adaptedProfileData.category}
              />
              <SocialMediaProfile
                contact={adaptedProfileData.contact}
                profileName={adaptedProfileData.name}
                socialMedia={adaptedProfileData.socialMedia}
              />

              <AccountTypeSection accountType={adaptedProfileData.accountType} />

              {/* Compartir perfil en móvil */}
              <ShareProfile
                profileName={adaptedProfileData.name}
                profileUrl={typeof window !== 'undefined' ? `${window.location.origin}/perfil/${createProfileSlug(adaptedProfileData.name, adaptedProfileData.id)}` : ''}
              />
            </div>

            {/* Componentes para versión desktop (la estructura original se mantiene para desktop) */}
            <div className="hidden lg:block space-y-8">
              <DescriptionProfile
                description={adaptedProfileData.description}
                services={adaptedProfileData.services}
                basicServices={adaptedProfileData.basicServices}
                additionalServices={adaptedProfileData.additionalServices}
              />

              <VideoPlayer videos={adaptedProfileData.videos} />

              <div id="verification-section">
                <VerificationStatus profileId={id} />
              </div>
            </div>

            {/* Componentes reordenados para versión MOBILE */}
            <div className="block lg:hidden space-y-8">
              <DescriptionProfile
                description={adaptedProfileData.description}
                services={adaptedProfileData.services}
                basicServices={adaptedProfileData.basicServices}
                additionalServices={adaptedProfileData.additionalServices}
              />

              <VideoPlayer videos={adaptedProfileData.videos} />

              {/* En mobile, traemos los componentes del sidebar aquí para controlar el orden */}
              <PhysicalTraitsProfile
                physicalTraits={adaptedProfileData.physicalTraits}
              />

              <RatesProfile rates={adaptedProfileData.rates} />

              <AudioPlayer audios={profile.media?.audios || []} />

              <AvailabilityProfile
                availability={adaptedProfileData.availability}
              />

              {/* FACTORES DE CONFIABILIDAD AL FINAL PARA MOBILE */}
              <div id="verification-section-mobile">
                <VerificationStatus profileId={id} />
              </div>
            </div>
          </div>

          {/* === Sidebar (Desktop Only) === */}
          <aside className="hidden lg:block lg:col-span-2 space-y-6">
            {/* Header + redes en desktop */}
            <div className="space-y-4">
              <ProfielHeader
                name={adaptedProfileData.name}
                age={adaptedProfileData.age}
                category={adaptedProfileData.category}
              />
              <SocialMediaProfile
                contact={adaptedProfileData.contact}
                profileName={adaptedProfileData.name}
                socialMedia={adaptedProfileData.socialMedia}
              />

              <AccountTypeSection accountType={adaptedProfileData.accountType} />

              {/* Compartir perfil */}
              <ShareProfile
                profileName={adaptedProfileData.name}
                profileUrl={typeof window !== 'undefined' ? `${window.location.origin}/perfil/${createProfileSlug(adaptedProfileData.name, adaptedProfileData.id)}` : ''}
              />
            </div>

            <PhysicalTraitsProfile
              physicalTraits={adaptedProfileData.physicalTraits}
            />

            {/* RatesProfile movido al sidebar */}
            <RatesProfile rates={adaptedProfileData.rates} />

            <AudioPlayer audios={profile.media?.audios || []} />
            <AvailabilityProfile
              availability={adaptedProfileData.availability}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
