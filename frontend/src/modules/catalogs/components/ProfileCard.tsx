import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VerificationBar } from '@/components/VerificationBar/VerificationBar';
import type { ProfileCardData } from '@/types/profile.types';
import {
  formatLocation
} from '@/utils/profile.utils';
import { createProfileSlug } from '@/utils/slug';
import {
  Calendar,
  Camera,
  MapPin,
  Star,
  Tag,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface ProfileCardProps {
  profile: ProfileCardData;
  viewMode?: 'grid' | 'list';
  variant?: 'default' | 'featured' | 'compact';
}

export function ProfileCard({ profile, viewMode, variant = 'default' }: ProfileCardProps) {
  // Usar la categoría que viene directamente del backend
  const category = profile.category;

  // Variante para destacados: solo imagen rectangular
  if (variant === 'featured') {
    return (
      <Link href={`/perfil/${createProfileSlug(profile.name, profile._id)}`} className="block">
        <Card className={`group hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer relative ${profile.hasDestacadoUpgrade
          ? 'bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-100 dark:from-yellow-900/30 dark:via-orange-900/20 dark:to-yellow-900/30 border-2 border-yellow-400 shadow-lg shadow-yellow-500/30'
          : 'bg-card border-border'
          }`}>
          {/* Banner de DESTACADO */}
          {profile.hasDestacadoUpgrade && (
            <div className="pulse-destacado absolute top-0 left-0 right-0 z-20 animate-destacado-pulse">
              <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 text-white text-center py-1 px-2 text-xs font-bold tracking-wider shadow-md flex items-center justify-center gap-1">
                <Star className="h-3 w-3 fill-white" />
                DESTACADO
              </div>
            </div>
          )}

          <div className="relative h-72 w-full">
            <Image
              src={profile.media?.gallery?.[0] || '/placeholder.svg'}
              alt={profile.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Badges siempre visibles */}
            <div className="absolute top-3 right-3 flex flex-col items-end space-y-2 z-10">
              {profile.verification?.steps?.selfieVerification?.isVerified && (
                <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  <span className="text-xs">Fotos verificadas</span>
                </Badge>
              )}
              {category && (
                <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm border-none text-xs">
                  {category}
                </Badge>
              )}
            </div>

            {/* Overlay con información con pulso */}
            <div className="pulse-content absolute inset-0 flex flex-col justify-end pointer-events-none group-hover:pointer-events-auto z-10">
              <div className="p-4 bg-black/70 backdrop-blur-sm">
                <h3 className="font-semibold text-base text-white mb-1">
                  {profile.name}
                </h3>
                {profile.location && (
                  <p className="text-sm text-white/90 flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {formatLocation(profile.location) || 'Ciudad no especificada'}
                  </p>
                )}
                {profile.description && (
                  <p className="text-xs text-white/80 mt-2 line-clamp-3">
                    {profile.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  // Variante por defecto: card completa con información responsive
  return (
    <Link href={`/perfil/${createProfileSlug(profile.name, profile._id)}`} className="block">
      <Card className={`group hover:shadow-xl max-w-72 mx-auto group transition-all duration-300 overflow-hidden relative ${profile.hasDestacadoUpgrade
        ? 'bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-100 dark:from-yellow-900/30 dark:via-orange-900/20 dark:to-yellow-900/30 border-2 border-yellow-400 shadow-lg shadow-yellow-500/30'
        : 'bg-card border-border'
        }`}>
        {/* Layout responsive: horizontal en mobile, vertical en desktop */}
        <div className="flex flex-row sm:flex-col h-full w-full">
          {/* Imagen */}
          <div className="relative w-32 h-44 sm:w-full sm:h-56 md:h-96 lg:h-96 flex-shrink-0">
            <Image
              width={300}
              height={400}
              src={profile.media.gallery?.[0] || '/placeholder.svg'}
              alt={profile.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent sm:from-black/60" />

            {/* Banner de DESTACADO */}
            {profile.hasDestacadoUpgrade && (
              <div className="pulse-destacado absolute top-0 left-0 right-0 z-20 animate-destacado-pulse">
                <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 text-white text-center py-1 px-2 text-[10px] sm:text-xs font-bold tracking-wider shadow-md flex items-center justify-center gap-1">
                  <Star className="h-2 w-2 sm:h-3 sm:w-3 fill-white" />
                  DESTACADO
                </div>
              </div>
            )}

            {/* Badges siempre visibles - Movidos debajo del banner */}
            <div className="absolute top-8 right-1 sm:top-9 lg:top-10 sm:right-2 lg:right-3 flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 lg:space-x-2 z-10">
              {profile.verification?.steps?.selfieVerification?.isVerified && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 flex items-center gap-1 px-1.5 py-0.5"
                >
                  <Camera className="h-2 w-2 lg:h-3 lg:w-3 flex-shrink-0" />
                  <span className="text-[9px] lg:text-xs hidden sm:inline">Fotos verificadas</span>
                </Badge>
              )}
              {profile.online && (
                <div className="w-2 h-2 lg:w-3 lg:h-3 bg-green-500 rounded-full border border-white dark:border-gray-800 animate-pulse"></div>
              )}
              {profile.hasVideo && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 p-1 animate-destacado-pulse"
                >
                  <Video className="h-2 w-2 lg:h-3 lg:w-3" />
                </Badge>
              )}
            </div>

            {/* Contenido con animación de pulso - SOLO VISIBLE EN DESKTOP (sm y arriba) */}
            <div className="hidden sm:flex pulse-content absolute inset-0 p-4 lg:p-6 flex-col justify-end pointer-events-none group-hover:pointer-events-auto z-10">
              <div className="space-y-2 bg-black/70 backdrop-blur-sm rounded-lg p-3 lg:p-4">
                <h3 className="font-semibold text-base lg:text-lg text-white">
                  {profile.name}
                </h3>

                <div className="flex flex-col space-y-1 text-xs lg:text-sm text-white/90">
                  {category && (
                    <span className="flex items-center text-purple-300 font-medium">
                      <Tag className="h-3 w-3 mr-1" />

                      {category}
                    </span>
                  )}
                  <span className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {profile.age} años
                  </span>
                  <span className="flex items-center">
                    <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="line-clamp-1">
                      {formatLocation(profile.location)}
                    </span>
                  </span>
                </div>

                {profile.description && (
                  <p className="text-xs lg:text-sm text-white/80 line-clamp-3 mt-2">
                    {profile.description}
                  </p>
                )}

                {/* Barra de verificación */}
                {profile.verification && (
                  <div className="mt-2">
                    <VerificationBar
                      verification={profile.verification}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contenido lateral en MOBILE (siempre visible) */}
          <CardContent className="p-3 sm:hidden lg:p-6 flex-1 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-sm sm:text-base lg:text-lg text-foreground group-hover:text-red-600 transition-colors line-clamp-1">
                  {profile.name}
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 text-xs lg:text-sm text-muted-foreground mt-1 space-y-1 sm:space-y-0">
                  {profile.category && (
                    <span className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
                      <Tag className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                      {profile.category}
                    </span>
                  )}
                  <span className="flex items-center">
                    <Calendar className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                    {profile.age} años
                  </span>
                  <span className="flex items-center">
                    <MapPin className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                    <span className="line-clamp-1">
                      {formatLocation(profile.location)}
                    </span>
                  </span>
                </div>

                {profile.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                    {profile.description}
                  </p>
                )}

                {/* Barra de verificación */}
                {profile.verification?.steps?.selfieVerification?.isVerified && (
                  <div className="mt-2">
                    <VerificationBar
                      verification={profile.verification}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Botón visible en mobile */}
            <div className="mt-2">
              <Button
                className={`w-full text-white text-xs py-1 ${profile.hasDestacadoUpgrade
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
                  : 'bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600'
                  }`}
              >
                Ver perfil
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

export default ProfileCard;