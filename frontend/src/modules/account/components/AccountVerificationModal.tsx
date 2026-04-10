'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useUpdateUser, useUser } from '@/hooks/use-user';
import type { User } from '@/types/user.types';
import { uploadMultipleImages } from '@/utils/tools';
import {
    AlertTriangle,
    Building2,
    Camera,
    CheckCircle,
    Clock,
    FileText,
    Info,
    Shield,
    User as UserIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface AccountVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    verification_in_progress: boolean;
    userId: string;
}

export default function AccountVerificationModal({
    isOpen,
    onClose,
    verification_in_progress,
    userId,
}: AccountVerificationModalProps) {
    const [loading, setLoading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [selectedAccountType, setSelectedAccountType] = useState<'common' | 'agency'>('common');
    const [uploadedFiles, setUploadedFiles] = useState({
        image1: null as File | null,
        backDoc: null as File | null,
        image2: null as File | null,
        image3: null as File | null,
    });
    const { mutateAsync: updateUserMutation } = useUpdateUser();
    const { data: user } = useUser();

    useEffect(() => {
        if (user?.accountType) {
            setSelectedAccountType(user.accountType);
        }
    }, [user?.accountType]);

    const handleFileUpload = (fileType: 'image1' | 'image2' | 'image3', file: File) => {
        setUploadedFiles((prev) => ({
            ...prev,
            [fileType]: file,
        }));
    };

    const handleSubmitVerification = async () => {
        const toastId = 'account-verification';
        toast.loading('Guardando verificación...', { id: toastId });

        const existingUrls = user?.verificationDocument || [];

        // Recopilar solo los archivos que se han subido
        const filesToUpload = [
            uploadedFiles.image1,
            uploadedFiles.backDoc,
            uploadedFiles.image2,
            uploadedFiles.image3,
        ].filter((file): file is File => file !== null);

        try {
            setLoading(true);
            const updatedUrls = [...existingUrls];

            if (filesToUpload.length > 0) {
                const urls = await uploadMultipleImages(filesToUpload);
                const filteredUrls = urls.filter(
                    (url): url is string => url !== null,
                );
                let urlIndex = 0;

                if (uploadedFiles.image1) {
                    updatedUrls[0] = filteredUrls[urlIndex++];
                }
                if (uploadedFiles.backDoc) {
                    updatedUrls[3] = filteredUrls[urlIndex++];
                }
                if (uploadedFiles.image2) {
                    updatedUrls[1] = filteredUrls[urlIndex++];
                }
                if (uploadedFiles.image3) {
                    updatedUrls[2] = filteredUrls[urlIndex++];
                }
            }

            const verificationDocument = updatedUrls.filter(Boolean);

            if (verificationDocument.length === 0) {
                throw new Error('Debes subir al menos un documento para enviar la verificación.');
            }

            const shouldMarkVerificationInProgress = user?.isVerified
                ? hasNewFiles
                : true;

            const data: Partial<User> = {
                accountType: selectedAccountType,
                verificationDocument,
                verification_in_progress: shouldMarkVerificationInProgress,
            };

            await updateUserMutation({
                userId,
                data,
            });

            setShowUploadForm(false);
            setUploadedFiles({ image1: null, backDoc: null, image2: null, image3: null });
            toast.success('Información de cuenta actualizada con éxito.', { id: toastId });
            onClose();
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Error al guardar la información de verificación.';
            toast.error(message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const hasExistingDocuments = Boolean(user?.verificationDocument?.filter(Boolean).length);
    const hasNewFiles = Boolean(uploadedFiles.image1 || uploadedFiles.backDoc || uploadedFiles.image2 || uploadedFiles.image3);
    const accountTypeChanged = selectedAccountType !== (user?.accountType || 'common');
    const canSubmit = Boolean(selectedAccountType) && (hasNewFiles || hasExistingDocuments || accountTypeChanged);

    const handleClose = () => {
        setShowUploadForm(false);
        setUploadedFiles({ image1: null, backDoc: null, image2: null, image3: null });
        onClose();
    };

    // Si el usuario está verificado, mostrar panel de administración
    if (user?.isVerified && !showUploadForm) {
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Cuenta Verificada
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 p-4">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                ¡Tu cuenta está verificada!
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                Tu identidad ha sido confirmada y tu cuenta está completamente verificada.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        <div>
                                            <p className="font-medium text-green-800 dark:text-green-200">
                                                Verificación Completa
                                            </p>
                                            <p className="text-sm text-green-600 dark:text-green-400">
                                                Todos tus documentos han sido aprobados
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-muted/40 border-border">
                                <CardContent className="p-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Tipo de cuenta</p>
                                        <p className="text-sm text-muted-foreground">
                                            {user?.accountType === 'agency' ? 'Agencia' : 'Individual'}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => setShowUploadForm(true)}
                                        variant="outline"
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Actualizar datos
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="text-center">
                            <p className="text-xs text-muted-foreground">
                                Tu cuenta está completamente verificada. Si necesitas actualizar tu información, contacta al soporte.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (verification_in_progress && !showUploadForm) {
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-md">
                    <VisuallyHidden>
                        <DialogTitle>Verificación en Progreso</DialogTitle>
                    </VisuallyHidden>
                    <div className="text-center p-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-4">
                            Verificación en Progreso
                        </h2>
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                            Su cuenta está siendo verificada. Este proceso puede tomar entre
                            24-48 horas. Le notificaremos por email una vez que la
                            verificación esté completa.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                <strong>Tiempo estimado:</strong> 24-48 horas
                                <br />
                                <strong>Estado:</strong> En revisión
                                <br />
                                <strong>Tipo de cuenta:</strong> {user?.accountType === 'agency' ? 'Agencia' : 'Individual'}
                            </p>
                        </div>

                        {/* Botón para actualizar documentos */}
                        <Button
                            onClick={() => setShowUploadForm(true)}
                            variant="outline"
                            className="w-full justify-center"
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            Actualizar documentos y tipo de cuenta
                        </Button>

                        <p className="text-xs text-muted-foreground mt-4">
                            Si necesitas actualizar tu información de verificación, puedes subir nuevos documentos.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (showUploadForm) {
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="text-center pb-6">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <DialogTitle className="text-2xl font-bold text-foreground">
                            Verificación de Identidad
                        </DialogTitle>
                        <p className="text-muted-foreground">
                            Sube los documentos requeridos para verificar tu identidad
                        </p>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-foreground font-medium">Tipo de cuenta</Label>
                            <RadioGroup
                                value={selectedAccountType}
                                onValueChange={(value) => setSelectedAccountType(value as 'common' | 'agency')}
                                className="space-y-3"
                            >
                                <Label htmlFor="verification-common" className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition-colors flex-1">
                                    <RadioGroupItem value="common" id="verification-common" />
                                    <div className="flex items-center gap-3 cursor-pointer flex-1">
                                        <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                                            <UserIcon className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">Cuenta Individual</p>
                                            <p className="text-sm text-muted-foreground">Para gestionar tu actividad personal.</p>
                                        </div>
                                    </div>
                                </Label>
                                <Label htmlFor="verification-agency" className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition-colors flex-1">
                                    <RadioGroupItem value="agency" id="verification-agency" />
                                    <div className="flex items-center gap-3 cursor-pointer flex-1">
                                        <div className="flex items-center justify-center w-10 h-10 bg-pink-100 rounded-full">
                                            <Building2 className="w-5 h-5 text-pink-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">Cuenta de Agencia</p>
                                            <p className="text-sm text-muted-foreground">Para administrar varios perfiles o un negocio.</p>
                                        </div>
                                    </div>
                                </Label>
                            </RadioGroup>
                        </div>

                        <div className="grid grid-cols-1 gap-6">

                            {/* Imagen 1: Documento de Identidad (Frente) */}
                            <div className="space-y-3">
                                <Label className="text-foreground font-medium">
                                    Documento de Identidad (Frente)
                                </Label>

                                {/* Imagen de referencia */}
                                <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                        📋 Ejemplo de referencia:
                                    </p>
                                    <div className="flex justify-center">
                                        <img
                                            src="/images/documento frontal.png"
                                            alt="Ejemplo de documento frontal"
                                            className="max-w-full h-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700"
                                        />
                                    </div>
                                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 text-center">
                                        Foto clara del frente del documento de identidad
                                    </p>
                                </div>

                                {/* Área de carga */}
                                <div
                                    className={`relative border-2 border-dashed rounded-lg text-center transition-colors duration-200 
        ${uploadedFiles.image1
                                            ? 'border-green-300 bg-green-50/30 dark:bg-green-950/10'
                                            : 'hover:border-purple-500 border-muted-foreground/30'
                                        } cursor-pointer`}
                                >
                                    {/* ✅ Input invisible que cubre todo el área */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload('image1', file);
                                        }}
                                        id="image1-upload"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />

                                    {/* Contenido visible */}
                                    <div className="p-8 flex flex-col items-center justify-center pointer-events-none">
                                        {uploadedFiles.image1 ? (
                                            <>
                                                <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                                                <p className="text-sm text-foreground font-medium">
                                                    {uploadedFiles.image1.name}
                                                </p>
                                                <p className="text-xs text-green-600 mt-1">
                                                    Archivo cargado correctamente
                                                </p>
                                            </>
                                        ) : user?.verificationDocument?.[0] ? (
                                            <>
                                                <div className="mb-3">
                                                    <img
                                                        src={user.verificationDocument[0]}
                                                        alt="Documento actual"
                                                        className="max-w-full h-auto max-h-32 rounded-lg border border-gray-300 dark:border-gray-600"
                                                    />
                                                </div>
                                                <CheckCircle className="h-8 w-8 text-blue-500 mb-2" />
                                                <p className="text-sm text-foreground font-medium">
                                                    Documento actual subido
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Clic para cambiar
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    Subir documento (frente)
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    JPG, PNG hasta 10MB
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Imagen Reverso: Documento de Identidad (Reverso) */}
                            {(() => {
                                const hasFrontDoc = Boolean(uploadedFiles.image1 || user?.verificationDocument?.[0]);
                                const isDisabled = !hasFrontDoc;
                                return (
                                    <div className="space-y-3">
                                        <Label className={`font-medium ${isDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                                            Documento de Identidad (Reverso)
                                            {isDisabled && (
                                                <span className="ml-2 text-xs text-amber-600 font-normal">
                                                    — Sube primero el frente del documento
                                                </span>
                                            )}
                                        </Label>

                                        <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                                            <p className={`text-sm font-medium mb-2 ${isDisabled ? 'text-muted-foreground' : 'text-blue-800 dark:text-blue-200'}`}>
                                                📋 Ejemplo de referencia:
                                            </p>
                                            <p className={`text-xs mt-2 text-center ${isDisabled ? 'text-muted-foreground' : 'text-blue-700 dark:text-blue-300'}`}>
                                                Foto clara del reverso del documento de identidad
                                            </p>
                                        </div>

                                        <div
                                            className={`relative border-2 border-dashed rounded-lg text-center transition-colors duration-200
                                                ${isDisabled
                                                    ? 'border-muted-foreground/20 bg-muted/30 cursor-not-allowed opacity-60'
                                                    : uploadedFiles.backDoc
                                                        ? 'border-green-300 bg-green-50/30 dark:bg-green-950/10 cursor-pointer'
                                                        : user?.verificationDocument?.[3]
                                                            ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/10 cursor-pointer'
                                                            : 'hover:border-purple-500 border-muted-foreground/30 cursor-pointer'
                                                }`}
                                        >
                                            <input
                                                type="file"
                                                accept="image/*"
                                                disabled={isDisabled}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleFileUpload('backDoc', file);
                                                }}
                                                className={`absolute inset-0 w-full h-full opacity-0 z-10 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                            />
                                            <div className="p-8 flex flex-col items-center justify-center pointer-events-none">
                                                {uploadedFiles.backDoc ? (
                                                    <>
                                                        <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                                                        <p className="text-sm text-foreground font-medium">{uploadedFiles.backDoc.name}</p>
                                                        <p className="text-xs text-green-600 mt-1">Archivo cargado correctamente</p>
                                                    </>
                                                ) : user?.verificationDocument?.[3] ? (
                                                    <>
                                                        <div className="mb-3">
                                                            <img
                                                                src={user.verificationDocument[3]}
                                                                alt="Reverso actual"
                                                                className="max-w-full h-auto max-h-32 rounded-lg border border-gray-300 dark:border-gray-600"
                                                            />
                                                        </div>
                                                        <CheckCircle className="h-8 w-8 text-blue-500 mb-2" />
                                                        <p className="text-sm text-foreground font-medium">Documento actual subido</p>
                                                        <p className="text-xs text-blue-600 mt-1">Clic para cambiar</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Camera className={`h-10 w-10 mb-2 ${isDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`} />
                                                        <p className={`text-sm ${isDisabled ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                                            Subir documento (reverso)
                                                        </p>
                                                        <p className={`text-xs mt-1 ${isDisabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                                                            JPG, PNG hasta 10MB
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Imagen 2: Video o Foto de Verificación con Cartel */}
                            <div className="space-y-3">
                                <Label className="text-foreground font-medium">
                                    Video o Foto de Verificación con Cartel
                                </Label>

                                {/* Imagen de referencia */}
                                <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                        📋 Ejemplo de referencia:
                                    </p>
                                    <div className="flex justify-center">
                                        <img
                                            src="/images/perfil con cartel.png"
                                            alt="Ejemplo de foto con cartel"
                                            className="max-w-full h-auto max-h-48 rounded-lg border border-blue-300"
                                        />
                                    </div>
                                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-2 text-center">
                                        La persona debe sostener un cartel con su nombre y la fecha
                                    </p>
                                </div>

                                {/* Área de carga */}
                                <div
                                    className={`relative border-2 border-dashed rounded-lg text-center transition-colors duration-200 
        ${uploadedFiles.image2
                                            ? 'border-green-300 bg-green-50/30 dark:bg-green-950/10'
                                            : user?.verificationDocument?.[1]
                                                ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/10'
                                                : 'hover:border-purple-500 border-muted-foreground/30'
                                        } cursor-pointer`}
                                >
                                    <input
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload('image2', file);
                                        }}
                                        id="image2-upload"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />

                                    <div className="p-8 flex flex-col items-center justify-center pointer-events-none">
                                        {uploadedFiles.image2 ? (
                                            <>
                                                <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                                                <p className="text-sm text-foreground font-medium">
                                                    {uploadedFiles.image2.name}
                                                </p>
                                                <p className="text-xs text-green-600 mt-1">
                                                    Archivo cargado correctamente
                                                </p>
                                            </>
                                        ) : user?.verificationDocument?.[1] ? (
                                            <>
                                                <div className="mb-3">
                                                    <img
                                                        src={user.verificationDocument[1]}
                                                        alt="Documento actual"
                                                        className="max-w-full h-auto max-h-32 rounded-lg border border-gray-300 dark:border-gray-600"
                                                    />
                                                </div>
                                                <CheckCircle className="h-8 w-8 text-blue-500 mb-2" />
                                                <p className="text-sm text-foreground font-medium">
                                                    Documento actual subido
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Clic para cambiar
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    Subir video o foto con cartel
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    JPG, PNG, MP4, MOV hasta 50MB
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Imagen 3: Foto con Documento al Lado del Rostro */}
                            <div className="space-y-3">
                                <Label className="text-foreground font-medium">
                                    Foto con Documento al Lado del Rostro
                                </Label>

                                {/* Imagen de referencia */}
                                <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                        📋 Ejemplo de referencia:
                                    </p>
                                    <div className="flex justify-center">
                                        <img
                                            src="/images/document guide.png"
                                            alt="Ejemplo de rostro con documento"
                                            className="max-w-full h-auto max-h-48 rounded-lg border border-blue-300"
                                        />
                                    </div>
                                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-2 text-center">
                                        Sostén tu documento al lado de tu rostro (mismo documento de la foto frontal)
                                    </p>
                                </div>

                                {/* Área de carga */}
                                <div
                                    className={`relative border-2 border-dashed rounded-lg text-center transition-colors duration-200 
        ${uploadedFiles.image3
                                            ? 'border-green-300 bg-green-50/30 dark:bg-green-950/10'
                                            : user?.verificationDocument?.[2]
                                                ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/10'
                                                : 'hover:border-purple-500 border-muted-foreground/30'
                                        } cursor-pointer`}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload('image3', file);
                                        }}
                                        id="image3-upload"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />

                                    <div className="p-8 flex flex-col items-center justify-center pointer-events-none">
                                        {uploadedFiles.image3 ? (
                                            <>
                                                <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                                                <p className="text-sm text-foreground font-medium">
                                                    {uploadedFiles.image3.name}
                                                </p>
                                                <p className="text-xs text-green-600 mt-1">
                                                    Archivo cargado correctamente
                                                </p>
                                            </>
                                        ) : user?.verificationDocument?.[2] ? (
                                            <>
                                                <div className="mb-3">
                                                    <img
                                                        src={user.verificationDocument[2]}
                                                        alt="Documento actual"
                                                        className="max-w-full h-auto max-h-32 rounded-lg border border-gray-300 dark:border-gray-600"
                                                    />
                                                </div>
                                                <CheckCircle className="h-8 w-8 text-blue-500 mb-2" />
                                                <p className="text-sm text-foreground font-medium">
                                                    Documento actual subido
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Clic para cambiar
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="h-10 w-10 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    Subir foto con documento
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    JPG, PNG hasta 10MB
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requisitos importantes */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start space-x-3">
                                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                                        Requisitos importantes:
                                    </h4>
                                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                        <li>• Las imágenes/videos deben ser claras y legibles</li>
                                        <li>• Documento de identidad válido y vigente</li>
                                        <li>• El video/foto de verificación debe incluir un cartel con tu nombre y fecha</li>
                                        <li>• La foto con documento debe mostrar claramente tu rostro y el documento</li>
                                        <li>• No se aceptan capturas de pantalla</li>
                                        <li>• El proceso de verificación toma 24-48 horas</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="flex space-x-4 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowUploadForm(false)}
                                className="flex-1 hover:bg-muted/50 transition-colors duration-200"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSubmitVerification}
                                disabled={!canSubmit || loading}
                                className={`flex-1 transition-all duration-200 ${canSubmit
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white hover:scale-105'
                                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                                    }`}
                            >
                                Enviar a Verificación
                            </Button>
                        </div>
                    </div>

                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <VisuallyHidden>
                    <DialogTitle>Verificación Requerida</DialogTitle>
                </VisuallyHidden>
                <div className="text-center p-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-4">
                        Verificación Requerida
                    </h2>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                        La verificación nos ayuda a mantener la seguridad y confianza en nuestra plataforma.
                    </p>
                    <Button
                        onClick={() => setShowUploadForm(true)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25"
                    >
                        <Shield className="h-4 w-4 mr-2" />
                        Completar verificación
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                        Aquí también podrás definir el tipo de cuenta con el que quieres operar.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}