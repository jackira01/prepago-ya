'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { initiatePasswordCreation } from '@/lib/account-linking';
import { AlertCircle, CheckCircle, Eye, EyeOff, Info, Loader2, Lock, Mail } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';

// Esquema de validación
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function SignInLayout() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [googleOnlyError, setGoogleOnlyError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Manejar mensajes de URL
  useEffect(() => {
    const message = searchParams.get('message');
    const errorParam = searchParams.get('error');

    if (message === 'password_created') {
      setSuccess('Contraseña creada exitosamente. Ya puedes iniciar sesión.');
    } else if (errorParam) {
      switch (errorParam) {
        case 'CredentialsSignin':
          setAuthError('Credenciales inválidas. Verifica tu email y contraseña.');
          break;
        case 'AccessDenied':
          setAuthError('Acceso denegado. Contacta al administrador.');
          break;
        default:
          setAuthError('Error de autenticación. Intenta de nuevo.');
      }
    }
  }, [searchParams]);

  // Validar campo individual
  const validateField = (name: keyof LoginFormData, value: string) => {
    try {
      loginSchema.shape[name].parse(value);
      setErrors(prev => ({ ...prev, [name]: undefined }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [name]: error.errors[0]?.message }));
      }
    }
  };

  // Manejar cambios en inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Validar en tiempo real si el campo ya tiene error
    if (errors[name as keyof LoginFormData]) {
      validateField(name as keyof LoginFormData, value);
    }
  };

  // Validar formulario completo
  const validateForm = (): boolean => {
    try {
      loginSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<LoginFormData> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof LoginFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  // Manejar creación de contraseña
  const handleCreatePassword = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevenir comportamiento por defecto
    e.stopPropagation(); // Evitar propagación del evento

    if (!formData.email) {
      setAuthError('Por favor ingresa tu email primero');
      return;
    }

    setIsLoading(true);
    try {
      // Normalizar email a minúsculas
      const normalizedEmail = formData.email.toLowerCase().trim();

      const result = await initiatePasswordCreation(normalizedEmail);
      if (result.success) {
        router.push(`/autenticacion/crear-contrasena?email=${encodeURIComponent(normalizedEmail)}`);
      } else {
        setAuthError(result.message);
      }
    } catch (err) {
      setAuthError('Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccess(null);
    setInfo(null);
    setShowCreatePassword(false);
    setGoogleOnlyError(false);

    // Validar formulario
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const normalizedEmail = formData.email.toLowerCase().trim();

      // Pre-check directo al backend para detectar el proveedor del usuario
      // antes de pasar por NextAuth, evitando que envuelva los errores
      const checkRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/check-auth-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const checkData = await checkRes.json();

      if (checkData.success && checkData.isGoogleOnly) {
        setGoogleOnlyError(true);
        return;
      }

      const result = await signIn('credentials', {
        redirect: false,
        email: normalizedEmail,
        password: formData.password,
      });

      if (!result) {
        setAuthError('Error inesperado. Por favor, intenta recargar la página.');
        return;
      }

      if (result.error) {
        if (result.error === 'AccessDenied') {
          setAuthError('Acceso denegado. Verifica tu cuenta o contacta al administrador.');
        } else {
          setAuthError('Email o contraseña incorrectos. Verifica tus datos e intenta nuevamente.');
        }
        return;
      }

      // Login exitoso - redirigir
      setSuccess('¡Bienvenido! Redirigiendo...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error('Error durante el login:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setAuthError('Error de conexión. Verifica tu internet e intenta nuevamente.');
      } else {
        setAuthError('Error inesperado. Por favor, intenta nuevamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar login con Google
  const handleGoogleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevenir cualquier comportamiento por defecto
    e.stopPropagation(); // Evitar propagación del evento

    // Limpiar errores previos
    setAuthError(null);
    setSuccess(null);
    setInfo(null);
    setGoogleOnlyError(false);

    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (error) {
      console.error('Error con Google Sign-In:', error);
      setAuthError('Error al conectar con Google. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa a tu cuenta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mensajes de estado */}
          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {info && (
            <Alert className="border-blue-200 bg-blue-50 text-blue-800">
              <Info className="h-4 w-4" />
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          {googleOnlyError && (
            <Alert className="border-orange-200 bg-orange-50 text-orange-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">Esta cuenta está vinculada a Google</p>
                <p className="text-sm">Tu cuenta fue creada con Google. Debes iniciar sesión con Google para continuar.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 border-orange-400 text-orange-800 hover:bg-orange-100"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continuar con Google
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={() => validateField('email', formData.email)}
                  className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={() => validateField('password', formData.password)}
                  className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Enlace de recuperación de contraseña */}
            <div className="text-right">
              <Link
                href="/autenticacion/recuperar-contrasena"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Botón de envío */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>

            {/* Botón para crear contraseña */}
            {showCreatePassword && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCreatePassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Crear Contraseña'
                )}
              </Button>
            )}
          </form>

          {/* Separador */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O continúa con
              </span>
            </div>
          </div>

          {/* Login con Google */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 text-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg
                className="h-8 w-8" // tamaño real más grande
                viewBox="0 0 48 48"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.94 0 6.58 1.7 8.1 3.12l5.93-5.93C34.6 3.6 29.8 1.5 24 1.5 14.82 1.5 7 7.44 3.84 15.5l7.02 5.46C12.38 15.6 17.6 9.5 24 9.5z"
                />
                <path
                  fill="#34A853"
                  d="M46.5 24c0-1.6-.15-3.12-.43-4.5H24v9h12.7c-.57 2.9-2.27 5.35-4.8 7.02l7.38 5.74C43.3 37.35 46.5 31.25 46.5 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.86 28.12a13.9 13.9 0 0 1-.86-4.12c0-1.43.3-2.8.86-4.12l-7.02-5.46A22.46 22.46 0 0 0 1.5 24c0 3.7.9 7.18 2.34 10.12l7.02-6z"
                />
                <path
                  fill="#4285F4"
                  d="M24 46.5c6.48 0 11.9-2.14 15.88-5.84l-7.38-5.74c-2.07 1.4-4.72 2.23-8.5 2.23-6.4 0-11.62-4.1-13.62-9.79l-7.02 6C7 40.56 14.82 46.5 24 46.5z"
                />
              </svg>
            )}
            <span className="text-lg font-semibold">Continuar con Google</span>
          </Button>


          {/* Enlaces adicionales */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              ¿No tienes una cuenta?{' '}
              <Link
                href="/autenticacion/registrarse"
                className="font-medium text-primary hover:underline"
              >
                Regístrate aquí
              </Link>
            </p>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              ← Volver al inicio
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}