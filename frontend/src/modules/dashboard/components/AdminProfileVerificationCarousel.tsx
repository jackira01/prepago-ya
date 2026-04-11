'use client';

import CloudinaryImage from '@/components/CloudinaryImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useConfigValue } from '@/hooks/use-config-parameters';
import { useProfile } from '@/hooks/use-profile';
import { useProfileVerification } from '@/hooks/use-profile-verification';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Facebook,
  Instagram,
  Twitter,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getVerifiedCount, verificationSteps } from '../config/verificationSteps.config';
import { useProfileVerificationMutation, useUpdateVerificationStatusMutation } from '../hooks/useProfileVerificationMutation';
import { useUpdateProfileMutation } from '../hooks/useUpdateProfileMutation';
import { useVerificationChanges } from '../hooks/useVerificationChanges';
import type { AdminProfileVerificationCarouselProps, ProfileVerificationData } from '../types/verification.types';
import VerificationStepRenderer from './VerificationStepRenderer';

// Component implementation

const AdminProfileVerificationCarousel: React.FC<
  AdminProfileVerificationCarouselProps
> = ({ isOpen, onOpenChange, profileName, profileId }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isActiveLocal, setIsActiveLocal] = useState<boolean>(true);
  const [isVisibleLocal, setIsVisibleLocal] = useState<boolean>(false);
  const [verificationStatusLocal, setVerificationStatusLocal] = useState<string>('pending');
  const queryClient = useQueryClient();

  // Fetch verification data using the hook
  const {
    data: verificationData,
    isLoading,
    error,
  } = useProfileVerification(profileId) as {
    data: ProfileVerificationData | undefined;
    isLoading: boolean;
    error: any;
  };

  // Robust ID extraction
  const verificationId = (verificationData as any)?.data?._id || (verificationData as any)?._id;

  // Sincronizar verificationStatusLocal con los datos de verificación
  useEffect(() => {
    if (verificationData?.verificationStatus) {
      setVerificationStatusLocal(verificationData.verificationStatus);
    } else if ((verificationData as any)?.data?.verificationStatus) {
      setVerificationStatusLocal((verificationData as any).data.verificationStatus);
    }
  }, [verificationData]);

  // Fetch profile data using the hook
  const profileData = useProfile(profileId);

  // Fetch config values for verification thresholds
  const { value: minAgeMonthsConfig } = useConfigValue<number>('profile.verification.minimum_age_months', { defaultValue: 12 });

  // Custom hooks for managing verification changes
  const {
    hasChanges,
    handleToggleVerification,
    handleVideoLinkChange,
    getCurrentVerificationStatus,
    getCurrentVideoLink,
    resetChanges,
    buildUpdatedSteps,
  } = useVerificationChanges();

  // Mutation hook for updating verification
  const updateVerificationMutation = useProfileVerificationMutation({
    profileId,
    verificationId,
    onSuccess: () => {
      // Callback adicional si es necesario
    }
  });

  // Mutation hook for updating verification status
  const updateVerificationStatusMutation = useUpdateVerificationStatusMutation({
    profileId,
    verificationId,
    onSuccess: () => {
      // Callback adicional si es necesario
    }
  });

  // Mutation hook for updating profile
  const updateProfileMutation = useUpdateProfileMutation({
    profileId,
    onSuccess: () => {
      // Callback adicional si es necesario
    }
  });

  // Sincronizar isActiveLocal y isVisibleLocal con los datos del perfil
  useEffect(() => {
    if (profileData.data?.isActive !== undefined) {
      setIsActiveLocal(profileData.data.isActive);
    }
    if (profileData.data?.visible !== undefined) {
      setIsVisibleLocal(profileData.data.visible);
    }
  }, [profileData.data?.isActive, profileData.data?.visible]);

  // Detectar si isActive ha cambiado
  const hasIsActiveChanged = profileData.data?.isActive !== undefined && profileData.data.isActive !== isActiveLocal;

  // Detectar si visible ha cambiado
  const hasIsVisibleChanged = profileData.data?.visible !== undefined && profileData.data.visible !== isVisibleLocal;

  // Detectar si verificationStatus ha cambiado
  const originalVerificationStatus = verificationData?.verificationStatus || (verificationData as any)?.data?.verificationStatus || 'pending';
  const hasVerificationStatusChanged = verificationStatusLocal !== originalVerificationStatus;

  // Detectar si hay cambios en general (verificación + isActive + visible + verificationStatus)
  const hasAnyChanges = hasChanges || hasIsActiveChanged || hasIsVisibleChanged || hasVerificationStatusChanged;

  // Función personalizada para guardar todos los cambios
  const handleSaveAllChanges = async () => {

    try {
      // Guardar cambios de isActive o visible si han cambiado
      if (hasIsActiveChanged || hasIsVisibleChanged) {
        const updateData: any = {};
        if (hasIsActiveChanged) updateData.isActive = isActiveLocal;
        if (hasIsVisibleChanged) updateData.visible = isVisibleLocal;
        await updateProfileMutation.mutateAsync(updateData);
      }

      // Guardar cambios de verificationStatus si han cambiado
      if (hasVerificationStatusChanged) {
        await updateVerificationStatusMutation.mutateAsync({
          verificationStatus: verificationStatusLocal
        });
      }

      // Guardar cambios de verificación (steps) si los hay
      if (hasChanges) {
        await handleSaveChanges();
      }

      // Invalidar queries para refrescar el estado en el dashboard
      await queryClient.invalidateQueries({ queryKey: ['adminProfiles'] });
      await queryClient.invalidateQueries({ queryKey: ['profileDetails', profileId] });

      toast.success('Todos los cambios han sido guardados exitosamente');
    } catch (error) {
      console.error('❌ Error al guardar los cambios:', error);
      toast.error('Error al guardar los cambios');
    }
  };

  // Función personalizada para cancelar todos los cambios
  const handleCancelAllChanges = () => {
    // Restaurar isActive y visible al valor original
    if (profileData.data?.isActive !== undefined) {
      setIsActiveLocal(profileData.data.isActive);
    }
    if (profileData.data?.visible !== undefined) {
      setIsVisibleLocal(profileData.data.visible);
    }

    // Restaurar verificationStatus al valor original
    if (verificationData?.verificationStatus) {
      setVerificationStatusLocal(verificationData.verificationStatus);
    } else if ((verificationData as any)?.data?.verificationStatus) {
      setVerificationStatusLocal((verificationData as any).data.verificationStatus);
    }

    // Cancelar cambios de verificación
    resetChanges();
  };

  // Current step and navigation
  const currentStep = verificationSteps[currentStepIndex];

  // Navigation functions
  const handlePrevious = () => {
    setCurrentStepIndex((prev) =>
      prev > 0 ? prev - 1 : verificationSteps.length - 1,
    );
  };

  const handleNext = () => {
    setCurrentStepIndex((prev) =>
      prev < verificationSteps.length - 1 ? prev + 1 : 0,
    );
  };

  // Save and cancel functions
  const handleSaveChanges = async () => {
    // Verificar si tenemos datos de verificación válidos
    if (!verificationData) {
      toast.error('No se puede guardar: datos de verificación no disponibles');
      return;
    }

    // Verificar si tenemos el ID de verificación
    if (!verificationId) {
      toast.error('No se puede guardar: ID de verificación no disponible');
      return;
    }

    try {
      const updatedSteps = buildUpdatedSteps(verificationData);
      await updateVerificationMutation.mutateAsync(updatedSteps);
      resetChanges();
    } catch (error) {
      console.error('❌ Error al guardar cambios de verificación:', error);
      toast.error('Error al guardar los cambios de verificación');
    }
  };

  // Loading and error states
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verificación de Perfil</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando datos de verificación...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !verificationData) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error de Verificación</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center text-red-600">
              <p>Error al cargar los datos de verificación</p>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="mt-4"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Validación adicional para asegurar que verificationData esté completamente cargado
  if (!verificationData?.data?.steps) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verificación de Perfil</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando estructura de verificación...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>Verificación de Perfil - {profileName}</span>
              {hasChanges && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Cambios sin guardar
                </Badge>
              )}
            </DialogTitle>

            {/* Switches de estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Toggle para isActive */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Perfil Activo
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isActiveLocal ? 'El perfil está activo' : 'El perfil está inactivo'}
                  </span>
                </div>
                <Switch
                  checked={isActiveLocal}
                  onCheckedChange={setIsActiveLocal}
                  disabled={profileData.isLoading}
                />
              </div>

              {/* Toggle para Visible */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Perfil Visible
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isVisibleLocal ? 'El perfil es visible' : 'El perfil está oculto'}
                  </span>
                </div>
                <Switch
                  checked={isVisibleLocal}
                  onCheckedChange={setIsVisibleLocal}
                  disabled={profileData.isLoading}
                />
              </div>

              {/* Toggle para Verification Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Estado de Revisión
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {verificationStatusLocal === 'check' ? 'Revisado' : 'Pendiente'}
                  </span>
                </div>
                <Switch
                  checked={verificationStatusLocal === 'check'}
                  onCheckedChange={(checked) => {
                    setVerificationStatusLocal(checked ? 'check' : 'pending');
                  }}
                  disabled={profileData.isLoading}
                />
              </div>

            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Paso {currentStepIndex + 1} de {verificationSteps.length}
              </div>
              <Badge
                variant={
                  getVerifiedCount(verificationData) === verificationSteps.length
                    ? 'default'
                    : 'secondary'
                }
              >
                {getVerifiedCount(verificationData)}/{verificationSteps.length} Revisados
              </Badge>
            </div>

            {/* Navigation dots */}
            <div className="flex justify-center gap-2">
              {verificationSteps.map((step, index) => (
                <button
                  type="button"
                  key={`verification-step-${step.key}-${index}`}
                  onClick={() => setCurrentStepIndex(index)}
                  className={`h-2 w-2 rounded-full transition-colors ${index === currentStepIndex
                    ? 'bg-primary'
                    : verificationData?.data?.steps?.[verificationSteps[index].key]
                      ?.isVerified
                      ? 'bg-green-500'
                      : 'bg-muted'
                    }`}
                />
              ))}
            </div>

            {/* Current step card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentStep.icon}
                    {currentStep.label}
                  </div>

                  {currentStep.key !== 'deposito' && (
                    <Badge
                      variant={
                        verificationData?.data?.steps?.[currentStep.key]?.isVerified
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {verificationData?.data?.steps?.[currentStep.key]?.isVerified ? (
                        <>
                          <Check className="h-3 w-3 mr-1" /> Verificado
                        </>
                      ) : (
                        <>
                          <X className="h-3 w-3 mr-1" /> No Verificado
                        </>
                      )}
                    </Badge>
                  )}
                  {!['deposito', 'accountAge', 'contactConsistency'].includes(currentStep.key) && (
                    <Switch
                      checked={getCurrentVerificationStatus(currentStep.key, verificationData)}
                      onCheckedChange={(checked) =>
                        handleToggleVerification(currentStep.key, checked)
                      }
                      disabled={updateVerificationMutation.isPending}
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentStep.description && (
                  <p className="text-sm text-muted-foreground">
                    {currentStep.description}
                  </p>
                )}

                {/* Document preview section */}
                {currentStep.key === 'socialMedia' ?
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    <h3 className="text-lg font-semibold">Redes Sociales</h3>

                    {(() => {
                      // Obtener los datos de socialMedia del modelo de perfil
                      const socialMedia = profileData.data?.socialMedia as any;

                      return socialMedia && (
                        socialMedia.instagram ||
                        socialMedia.facebook ||
                        socialMedia.tiktok ||
                        socialMedia.twitter ||
                        socialMedia.onlyFans
                      ) ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          {socialMedia.instagram && (
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-lg">
                                    <Instagram className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">Instagram</h4>
                                    <p className="text-sm text-muted-foreground break-all">
                                      {socialMedia.instagram}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      window.open(`https://www.instagram.com/${socialMedia.instagram}`, "_blank")
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {socialMedia.facebook && (
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                    <Facebook className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">Facebook</h4>
                                    <p className="text-sm text-muted-foreground break-all">
                                      {socialMedia.facebook}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      window.open(`https://www.facebook.com/${socialMedia.facebook}`, "_blank")
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {socialMedia.tiktok && (
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <ExternalLink className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">TikTok</h4>
                                    <p className="text-sm text-muted-foreground break-all">
                                      {socialMedia.tiktok}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      window.open(`https://www.tiktok.com/@${socialMedia.tiktok}`, "_blank")
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {socialMedia.twitter && (
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-sky-100 dark:bg-sky-900 rounded-lg">
                                    <Twitter className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">Twitter</h4>
                                    <p className="text-sm text-muted-foreground break-all">
                                      {socialMedia.twitter}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      window.open(`https://twitter.com/${socialMedia.twitter}`, "_blank")
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {socialMedia.onlyFans && (
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <ExternalLink className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">OnlyFans</h4>
                                    <p className="text-sm text-muted-foreground break-all">
                                      {socialMedia.onlyFans}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      window.open(`https://onlyfans.com/${socialMedia.onlyFans}`, "_blank")
                                    }
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                        </div>
                      ) : (
                        <Card>
                          <CardContent className="p-8 text-center">
                            <div className="space-y-3">
                              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto">
                                <ExternalLink className="h-8 w-8 text-gray-400" />
                              </div>
                              <h4 className="font-medium text-gray-600 dark:text-gray-400">
                                No hay redes sociales configuradas
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Este perfil no ha configurado ninguna red social
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div> :
                  currentStep.key === 'accountAge' ? (() => {
                    const accountAgeData = verificationData?.data?.steps?.accountAge as any;
                    const createdAt = profileData.data?.createdAt ? new Date(profileData.data.createdAt) : null;
                    const now = new Date();
                    const MONTHS_REQUIRED = minAgeMonthsConfig ?? 12;

                    const diffMs = createdAt ? now.getTime() - createdAt.getTime() : 0;
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const diffMonths = createdAt
                      ? (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth())
                      : 0;
                    const monthsRemaining = Math.max(0, MONTHS_REQUIRED - diffMonths);

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                            <span className="text-sm font-medium">Fecha de creación</span>
                            <span className="text-sm text-muted-foreground">
                              {createdAt ? createdAt.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No disponible'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                            <span className="text-sm font-medium">Tiempo desde creación</span>
                            <span className="text-sm text-muted-foreground">
                              {diffMonths > 0 ? `${diffMonths} mes${diffMonths !== 1 ? 'es' : ''}` : `${diffDays} día${diffDays !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                            <span className="text-sm font-medium">Antigüedad requerida</span>
                            <span className="text-sm text-muted-foreground">{MONTHS_REQUIRED} meses</span>
                          </div>
                          <div className={`flex justify-between items-center p-3 rounded-lg ${accountAgeData?.isVerified ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                            <span className="text-sm font-medium">Estado</span>
                            <span className={`text-sm font-medium ${accountAgeData?.isVerified ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                              {accountAgeData?.isVerified ? '✅ Verificado automáticamente' : `⏳ Faltan ${monthsRemaining} mes${monthsRemaining !== 1 ? 'es' : ''}`}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Este dato es calculado automáticamente por el sistema y no requiere verificación manual.</p>
                      </div>
                    );
                  })() :
                    currentStep.key === 'contactConsistency' ? (() => {
                      const consistencyData = verificationData?.data?.steps?.contactConsistency as any;
                      const debug = consistencyData?.debug;
                      const hasChanged = debug?.hasChanged;
                      const lastChangeDate = debug?.lastChangeDate ? new Date(debug.lastChangeDate) : null;
                      const now = new Date();
                      const MONTHS_REQUIRED = 3;

                      const diffMonths = lastChangeDate
                        ? (now.getFullYear() - lastChangeDate.getFullYear()) * 12 + (now.getMonth() - lastChangeDate.getMonth())
                        : 0;
                      const monthsRemaining = Math.max(0, MONTHS_REQUIRED - diffMonths);

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                              <span className="text-sm font-medium">Tiene número de contacto</span>
                              <span className="text-sm text-muted-foreground">
                                {debug?.hasContactNumber ? 'Sí' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                              <span className="text-sm font-medium">¿Ha cambiado el contacto?</span>
                              <span className="text-sm text-muted-foreground">
                                {hasChanged === undefined ? 'Nunca ha cambiado' : hasChanged ? 'Sí' : 'No'}
                              </span>
                            </div>
                            {hasChanged && lastChangeDate && (
                              <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg">
                                <span className="text-sm font-medium">Último cambio</span>
                                <span className="text-sm text-muted-foreground">
                                  {lastChangeDate.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                              </div>
                            )}
                            <div className={`flex justify-between items-center p-3 rounded-lg ${consistencyData?.isVerified ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                              <span className="text-sm font-medium">Estado</span>
                              <span className={`text-sm font-medium ${consistencyData?.isVerified ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                {consistencyData?.isVerified
                                  ? '✅ Verificado automáticamente'
                                  : hasChanged
                                    ? `⏳ Faltan ${monthsRemaining} mes${monthsRemaining !== 1 ? 'es' : ''} sin cambios`
                                    : '⏳ Pendiente'}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Este dato es calculado automáticamente por el sistema y no requiere verificación manual.</p>
                        </div>
                      );
                    })() :
                      currentStep.key === 'deposito' ? (() => {
                        // Leer deposito desde el perfil (fuente de verdad) o verificación como fallback
                        const asksForDeposit = profileData.data?.deposito ?? (verificationData?.data?.steps as any)?.deposito;
                        const isUndefined = asksForDeposit === undefined || asksForDeposit === null;
                        return (
                          <div className="mt-4">
                            {isUndefined ? (
                              <div className="text-center p-4 border rounded-lg bg-muted/40">
                                <p className="text-sm text-muted-foreground">No se ha definido información de depósito para este perfil.</p>
                              </div>
                            ) : (
                              <div className={`text-center p-4 border rounded-lg ${!asksForDeposit ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
                                <p className={`text-lg font-medium ${!asksForDeposit ? 'text-green-800 dark:text-green-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                  {!asksForDeposit ? '✅ No solicita depósito por adelantado' : '⚠️ Solicita depósito por adelantado'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                  {!asksForDeposit ? 'Este perfil gana puntos de confianza.' : 'Este perfil no gana puntos extra por este factor.'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })() :
                        (<div className="border rounded-lg p-4">
                          {(() => {
                            // Obtener los datos del paso actual desde el objeto steps
                            const stepData = verificationData?.data?.steps?.[currentStep.key as keyof typeof verificationData.data.steps];

                            return (
                              <VerificationStepRenderer
                                step={currentStep}
                                stepData={stepData}
                                onPreviewImage={setPreviewImage}
                                getCurrentVideoLink={(stepKey) => getCurrentVideoLink(stepKey as any, verificationData)}
                                handleVideoLinkChange={(stepKey, link) => handleVideoLinkChange(stepKey as any, link)}
                              />
                            );
                          })()}
                        </div>)}
              </CardContent>
            </Card>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>

              <Button
                variant="outline"
                onClick={handleNext}
                className="flex items-center gap-2"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4 border-t">
              {hasAnyChanges ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelAllChanges}
                    className="flex-1"
                    disabled={updateVerificationMutation.isPending || updateProfileMutation.isPending}
                  >
                    Cancelar cambios
                  </Button>
                  <Button
                    onClick={handleSaveAllChanges}
                    className="flex-1"
                    disabled={
                      updateVerificationMutation.isPending ||
                      updateProfileMutation.isPending
                    }
                  >
                    {(updateVerificationMutation.isPending || updateProfileMutation.isPending) ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Image preview modal - Moved outside main dialog */}
      < Dialog
        open={!!previewImage
        }
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista previa de imagen</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex justify-center">
              <div className="relative">
                <CloudinaryImage
                  src={previewImage}
                  alt="Vista previa"
                  width={800}
                  height={600}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog >
    </>
  );
};

export default AdminProfileVerificationCarousel;
