/**
 * Servicio para notificar flujos a n8n mediante webhook.
 * Usa la variable de entorno N8N_WEBHOOK_URL_NOTIFICATION.
 */

export type N8nWebhookFlow =
    | 'user_registered'
    | 'profile_created'
    | 'profile_verification_updated'
    | 'user_verification_updated';

export interface N8nWebhookPayload {
    flow: N8nWebhookFlow;
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Mapas de etiquetas legibles para campos modificados
// ---------------------------------------------------------------------------

/**
 * Etiquetas para los pasos de verificación de perfil (UpdateVerificationStepsDTO).
 * Clave de nivel 1 → subcampo → etiqueta legible.
 * Si el valor del mapa es string, aplica a todo el paso sin importar el subcampo.
 */
const PROFILE_VERIFICATION_STEP_LABELS: Record<string, string | Record<string, string>> = {
    documentVerification: {
        frontPhoto: 'Foto frontal del documento',
        backPhoto: 'Foto trasera del documento',
        isVerified: 'Verificación de documento de identidad',
    },
    selfieVerification: {
        photo: 'Selfie con documento',
        isVerified: 'Verificación de selfie',
    },
    cartelVerification: {
        mediaLink: 'Cartel de verificación',
        mediaType: 'Tipo de medio del cartel',
        isVerified: 'Verificación de cartel',
    },
    videoCallRequested: {
        videoLink: 'Enlace de videollamada',
        isVerified: 'Verificación por videollamada',
    },
    socialMedia: {
        instagram: 'Perfil de Instagram',
        facebook: 'Perfil de Facebook',
        tiktok: 'Perfil de TikTok',
        twitter: 'Perfil de Twitter/X',
        onlyFans: 'Perfil de OnlyFans',
        isVerified: 'Verificación de redes sociales',
    },
    deposito: 'Depósito de verificación',
    phoneChangeDetected: 'Cambio de teléfono detectado',
    lastLogin: 'Último inicio de sesión',
    accountAge: 'Antigüedad de cuenta',
    contactConsistency: 'Consistencia de contacto',
};

/**
 * Etiquetas para los campos de actualización de usuario
 * que se envían en el flujo user_verification_updated.
 */
const USER_UPDATE_FIELD_LABELS: Record<string, string> = {
    accountType: 'Tipo de cuenta',
    verificationDocument: 'Documentos de verificación',
    verification_in_progress: 'Verificación en proceso',
    name: 'Nombre',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    profilePicture: 'Foto de perfil',
};

/**
 * Compara los pasos entrantes con los actuales y devuelve solo los que cambiaron.
 * Los valores vacíos/undefined se ignoran (no se consideran cambio).
 */
export function diffVerificationSteps(
    incoming: Record<string, unknown>,
    current: Record<string, unknown>
): Record<string, unknown> {
    const changed: Record<string, unknown> = {};

    for (const [key, incomingValue] of Object.entries(incoming)) {
        const currentValue = current[key];

        if (incomingValue === null || incomingValue === undefined) continue;

        // Comparación de objetos anidados
        if (typeof incomingValue === 'object' && !Array.isArray(incomingValue)) {
            const changedSub: Record<string, unknown> = {};

            for (const [subKey, subVal] of Object.entries(incomingValue as Record<string, unknown>)) {
                if (subVal === null || subVal === undefined || subVal === '') continue;

                const currentSub = (currentValue as Record<string, unknown> | undefined)?.[subKey];

                if (subVal !== currentSub) {
                    changedSub[subKey] = subVal;
                }
            }

            if (Object.keys(changedSub).length > 0) {
                changed[key] = changedSub;
            }
        } else {
            // Valor primitivo
            if (incomingValue !== '' && incomingValue !== currentValue) {
                changed[key] = incomingValue;
            }
        }
    }

    return changed;
}

/**
 * Convierte los pasos modificados de verificación de perfil en un array de etiquetas legibles.
 */
export function buildProfileVerificationLabels(stepsData: Record<string, unknown>): string[] {
    const labels: string[] = [];

    for (const [stepKey, stepValue] of Object.entries(stepsData)) {
        const mapping = PROFILE_VERIFICATION_STEP_LABELS[stepKey];

        if (!mapping) {
            labels.push(stepKey);
            continue;
        }

        if (typeof mapping === 'string') {
            labels.push(mapping);
            continue;
        }

        // mapping es un subdiccionario → iterar subcampos
        if (stepValue && typeof stepValue === 'object') {
            for (const subKey of Object.keys(stepValue as Record<string, unknown>)) {
                const subLabel = (mapping as Record<string, string>)[subKey];
                if (subLabel) {
                    labels.push(subLabel);
                } else {
                    labels.push(`${stepKey}.${subKey}`);
                }
            }
        } else {
            // No hay subcampos, usar la primera etiqueta disponible del grupo
            const firstLabel = Object.values(mapping)[0];
            labels.push(firstLabel ?? stepKey);
        }
    }

    return [...new Set(labels)]; // eliminar duplicados
}

/**
 * Convierte los campos de actualización de usuario en un array de etiquetas legibles.
 */
export function buildUserUpdateLabels(updateData: Record<string, unknown>): string[] {
    const sensitiveFields = new Set(['password', 'hashedPassword', '__v', 'verification_in_progress']);
    const labels: string[] = [];

    for (const key of Object.keys(updateData)) {
        if (sensitiveFields.has(key)) continue;
        labels.push(USER_UPDATE_FIELD_LABELS[key] ?? key);
    }

    return [...new Set(labels)];
}

/**
 * Envía una notificación al webhook de n8n con el flujo y los datos del evento.
 * Nunca lanza excepciones; los errores se registran en consola.
 */
export async function notifyN8nWebhook(payload: N8nWebhookPayload): Promise<void> {
    const webhookUrl = process.env.N8N_WEBHOOK_URL_NOTIFICATION;

    if (!webhookUrl) {
        console.warn('[n8n-webhook] N8N_WEBHOOK_URL_NOTIFICATION no está configurada, omitiendo notificación.');
        return;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`[n8n-webhook] Respuesta no exitosa: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('[n8n-webhook] Error al enviar notificación:', error);
    }
}
