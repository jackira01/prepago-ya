import CloudinaryImage from '@/components/CloudinaryImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Eye } from 'lucide-react';
import type { VerificationStepRenderProps } from '../types/verification.types';

const VerificationStepRenderer: React.FC<VerificationStepRenderProps> = ({
  step,
  stepData,
  onPreviewImage,
  getCurrentVideoLink,
  handleVideoLinkChange,
}) => {

  if (!stepData || typeof stepData !== 'object') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No hay datos disponibles para este paso de verificación.</p>
      </div>
    );
  }

  switch (step.key) {
    case 'documentVerification': {
      // Cast to any because types might not be fully updated in frontend yet
      const docData = stepData as any;
      const frontPhoto = docData.frontPhoto;
      const backPhoto = docData.backPhoto;

      return (
        <div className="mt-4 space-y-6">
          {/* Front Photo */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-center">Frente</h4>
            {frontPhoto ? (
              <div className="flex justify-center">
                <div className="relative group max-w-md">
                  <CloudinaryImage
                    src={frontPhoto}
                    alt="Documento de Identidad (Frente)"
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onPreviewImage(frontPhoto)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onPreviewImage(frontPhoto)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center">
                No se ha subido el documento de identidad (frente).
              </div>
            )}
          </div>

          {/* Back Photo */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-center">Reverso</h4>
            {backPhoto ? (
              <div className="flex justify-center">
                <div className="relative group max-w-md">
                  <CloudinaryImage
                    src={backPhoto}
                    alt="Documento de Identidad (Reverso)"
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onPreviewImage(backPhoto)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onPreviewImage(backPhoto)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center">
                No se ha subido el documento de identidad (reverso).
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'selfieVerification': {
      const photoData = stepData as any;
      const photoUrl = photoData.photo;

      if (!photoUrl) {
        return (
          <div className="mt-4 text-gray-500 text-center">
            No se ha subido la foto con documento al lado del rostro.
          </div>
        );
      }

      return (
        <div className="mt-4">
          <div className="flex justify-center">
            <div className="relative group max-w-md">
              <CloudinaryImage
                src={photoUrl}
                alt="Foto con Documento al Lado del Rostro"
                width={400}
                height={300}
                className="w-full h-auto object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onPreviewImage(photoUrl)}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                <Button
                  size="sm"
                  variant="secondary"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onPreviewImage(photoUrl)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'cartelVerification': {
      const mediaData = stepData as any;
      const currentVideoLink = getCurrentVideoLink('cartelVerification');

      return (
        <div className="mt-4 space-y-4">
          {/* Input para editar el videoLink */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Link de Video o Foto de Verificación con Cartel
            </label>
            <Input
              type="url"
              placeholder="https://..."
              value={currentVideoLink}
              onChange={(e) => handleVideoLinkChange('cartelVerification', e.target.value)}
              className="w-full"
            />
          </div>

          {/* Mostrar el video/imagen actual si existe */}
          {(currentVideoLink || mediaData.mediaLink) && (
            <div>
              {/* Check if it's a video file or external link */}
              {(
                (currentVideoLink || mediaData.mediaLink || '').includes('.mp4') ||
                (currentVideoLink || mediaData.mediaLink || '').includes('.webm') ||
                (currentVideoLink || mediaData.mediaLink || '').includes('.ogg') ||
                mediaData.mediaType === 'video'
              ) ? (
                <video
                  src={currentVideoLink || mediaData.mediaLink}
                  controls
                  className="w-full max-w-md mx-auto rounded-lg shadow-md"
                  style={{ maxHeight: '300px' }}
                >
                  Tu navegador no soporta el elemento de video.
                </video>
              ) : mediaData.mediaType === 'image' && mediaData.mediaLink ? (
                <CloudinaryImage
                  src={mediaData.mediaLink}
                  alt="Imagen de verificación con cartel"
                  width={400}
                  height={300}
                  className="w-full max-w-md mx-auto rounded-lg shadow-md cursor-pointer"
                  onClick={() => onPreviewImage(mediaData.mediaLink!)}
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(currentVideoLink || mediaData.mediaLink!, '_blank');
                  }}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver video de verificación
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'videoCallRequested': {
      const currentVideoLink = getCurrentVideoLink(step.key as 'videoCallRequested');

      return (
        <div className="mt-4 space-y-4">
          {/* Input para editar el videoLink de videollamada */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Link de Videollamada
            </label>
            <Input
              type="url"
              placeholder="https://meet.google.com/... o https://zoom.us/..."
              value={currentVideoLink}
              onChange={(e) => handleVideoLinkChange(step.key as 'videoCallRequested', e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Ingresa el enlace de la videollamada programada para verificación en tiempo real
            </p>
          </div>

          {/* Mostrar el video actual si existe */}
          {currentVideoLink && (
            <div>
              {(
                currentVideoLink.includes('.mp4') ||
                currentVideoLink.includes('.webm') ||
                currentVideoLink.includes('.ogg') ||
                currentVideoLink.includes('cloudinary') ||
                currentVideoLink.includes('res.cloudinary')
              ) ? (
                <video
                  src={currentVideoLink}
                  controls
                  className="w-full max-w-md mx-auto rounded-lg shadow-md"
                  style={{ maxHeight: '300px' }}
                >
                  Tu navegador no soporta el elemento de video.
                </video>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(currentVideoLink, '_blank');
                  }}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir videollamada
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'socialMedia': {
      const socialMediaData = stepData as any;

      return (
        <div className="mt-4">
          <div className="text-center p-4 border rounded-lg">
            <p className="text-sm text-gray-600">
              Estado de verificación social: {socialMediaData.isVerified ? 'Verificado' : 'Pendiente'}
            </p>
          </div>
        </div>
      );
    }

    case 'deposito': {
      const asksForDeposit = stepData as unknown as boolean;
      return (
        <div className="mt-4">
          <div className={`text-center p-4 border rounded-lg ${asksForDeposit === false ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <p className={`text-lg font-medium ${asksForDeposit === false ? 'text-green-800' : 'text-yellow-800'}`}>
              {asksForDeposit === false
                ? '✅ No solicita depósito por adelantado'
                : '⚠️ Solicita depósito por adelantado'}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {asksForDeposit === false
                ? 'Este perfil gana puntos de confianza.'
                : 'Este perfil no gana puntos extra por este factor.'}
            </p>
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="mt-4 text-gray-500 text-center">
          Tipo de verificación no reconocido.
        </div>
      );
  }
};

export default VerificationStepRenderer;
