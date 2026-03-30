import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { VerificationBar } from '@/components/VerificationBar/VerificationBar';
import type { ProfileCardData } from '@/types/profile.types';
import { formatLocation } from '@/utils/profile.utils';
import { createProfileSlug } from '@/utils/slug';
import { Calendar, Camera, MapPin, Star, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface CardComponentProps {
  profiles?: ProfileCardData[];
}

const CardComponent = ({ profiles = [] }: CardComponentProps) => {
  // Si no hay perfiles, mostrar mensaje
  if (!profiles || profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-300">No hay perfiles disponibles</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {profiles.map((profile, index) => (
        <Link href={`/perfil/${createProfileSlug(profile.name, profile._id)}`} key={profile._id}>
          <Card
            className={`group hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer md:w-60 lg:w-64 ${profile.hasDestacadoUpgrade
              ? 'bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-100 dark:from-yellow-900/30 dark:via-orange-900/20 dark:to-yellow-900/30 border-2 border-yellow-400 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50'
              : 'bg-card border-border hover:border-purple-500/50'
              }`}
            style={{ animationDelay: `${index * 200}ms` }}
          >
            {/* Layout responsive: horizontal en mobile, vertical en desktop */}
            <div className="flex flex-row sm:flex-col">
              {/* Imagen */}
              <div className="relative overflow-hidden w-32 h-full sm:h-48 md:w-full md:h-96 flex-shrink-0">
                <Image
                  width={400}
                  height={320}
                  src={profile.media?.gallery?.[0] || '/placeholder.svg'}
                  alt={profile.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
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
                <div className="absolute top-8 right-2 sm:top-9 sm:right-3 flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2 z-10">
                  {profile.verification?.steps?.selfieVerification?.isVerified && (
                    <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 hover:scale-110 transition-transform duration-200 flex items-center gap-1 px-1.5 py-0.5">
                      <Camera className="h-2 w-2 sm:h-3 sm:w-3 flex-shrink-0" />
                      <span className="text-[9px] sm:text-xs hidden sm:inline">Fotos verificadas</span>
                    </Badge>
                  )}
                  {profile.online && (
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
                  )}
                </div>

                {/* Contenido con animación de pulso - SOLO VISIBLE EN DESKTOP (sm y arriba) */}
                <div className="hidden sm:flex pulse-content absolute inset-0 p-4 flex-col justify-end pointer-events-none group-hover:pointer-events-auto z-10">
                  <div className="space-y-2 bg-black/70 backdrop-blur-sm rounded-lg p-3">
                    <h3 className="font-semibold text-base text-white line-clamp-1">
                      {profile.name}
                    </h3>

                    {/* 🔽 Cambiado de "flex items-center space-x-3" a "flex flex-col space-y-1" */}
                    <div className="flex flex-col space-y-1 text-xs text-white/90">
                      {profile.category && (
                        <span className="flex items-center text-purple-300 font-medium">
                          <Tag className="h-3 w-3 mr-1" />
                          {profile.category}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {profile.age || 'N/A'} años
                      </span>
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {formatLocation(profile.location) || 'N/A'}
                        </span>
                      </span>
                    </div>

                    {profile.description && (
                      <p className="text-xs text-white/80 line-clamp-4 mt-2">
                        {profile.description}
                      </p>
                    )}

                    {/* Barra de verificación */}
                    <div className="mt-2">
                      <VerificationBar
                        verification={profile.verification}
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Contenido lateral en MOBILE (siempre visible) */}
              <CardContent className="p-3 sm:hidden flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-purple-600 transition-colors duration-300 line-clamp-1">
                    {profile.name}
                  </h3>
                  <div className="flex flex-col text-xs text-muted-foreground space-y-1">
                    {profile.category && (
                      <span className="flex items-center text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 dark:hover:text-purple-300 transition-colors duration-200">
                        <Tag className="h-2 w-2 mr-1" />
                        {profile.category}
                      </span>
                    )}
                    <span className="flex items-center hover:text-foreground transition-colors duration-200">
                      <Calendar className="h-2 w-2 mr-1" />
                      {profile.age || 'N/A'} años
                    </span>
                    <span className="flex items-center hover:text-foreground transition-colors duration-200">
                      <MapPin className="h-2 w-2 mr-1" />
                      <span className="line-clamp-1">
                        {formatLocation(profile.location) || 'Ubicación no disponible'}
                      </span>
                    </span>
                  </div>

                  {profile.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-4">
                      {profile.description}
                    </p>
                  )}

                  {/* Barra de verificación */}
                  <div className="mt-2">
                    <VerificationBar
                      verification={profile.verification}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default CardComponent;