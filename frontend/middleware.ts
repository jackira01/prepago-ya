import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitResponse } from './src/lib/rate-limit';

// Lista de categorías válidas (debe coincidir con el backend)
const VALID_CATEGORIES = ['escort', 'masajista', 'modelo', 'acompañante'];

// Lista hardcodeada de departamentos para evitar problemas en build
const VALID_DEPARTMENTS = [
  'bogota', 'medellin', 'cali', 'barranquilla', 'cartagena', 'cucuta', 'bucaramanga',
  'pereira', 'santa-marta', 'ibague', 'pasto', 'manizales', 'neiva', 'villavicencio',
  'armenia', 'valledupar', 'monteria', 'sincelejo', 'popayan', 'buenaventura',
  'palmira', 'floridablanca', 'soledad', 'malambo', 'bello', 'itagui', 'envigado',
  'soacha', 'dosquebradas', 'giron', 'tunja', 'florencia', 'riohacha', 'quibdo',
  'yopal', 'mocoa', 'leticia', 'inirida', 'san-jose-del-guaviare', 'mitu',
  'puerto-carreno', 'arauca', 'casanare', 'vichada', 'guainia', 'guaviare',
  'vaupes', 'amazonas', 'antioquia', 'atlantico', 'bolivar', 'boyaca', 'caldas',
  'caqueta', 'cauca', 'cesar', 'choco', 'cordoba', 'cundinamarca', 'huila',
  'la-guajira', 'magdalena', 'meta', 'narino', 'norte-de-santander', 'putumayo',
  'quindio', 'risaralda', 'san-andres-y-providencia', 'santander', 'sucre',
  'tolima', 'valle-del-cauca'
];

// Lista de rutas que NO deben ser procesadas por el sistema de búsqueda
const EXCLUDED_ROUTES = [
  'cuenta', 'perfil', 'autenticacion', 'adminboard', 'api',
  'buscar', 'faq', 'precios', 'terminos', 'terms', 'blog', 'plans',
  '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'images',
  'placeholder-logo.png', 'placeholder-logo.svg', 'placeholder-user.jpg',
  'placeholder.jpg', 'placeholder.svg', 'installHook.js.map', 'installHook',
  '.well-known',
];

// ===== CONFIGURACIÓN DE AUTENTICACIÓN =====
// Rutas protegidas por rate limiting
const PROTECTED_ROUTES = [
  '/api/auth/signin',
  '/api/auth/callback/credentials',
  '/api/auth/register',
];

// Rutas que requieren autenticación
const AUTH_REQUIRED_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/cuenta',
  '/perfil',
  '/adminboard',
];

// Rutas que requieren rol de administrador
const ADMIN_REQUIRED_ROUTES = [
  '/adminboard',
];

// Rutas que requieren verificación de email
const EMAIL_VERIFICATION_REQUIRED_ROUTES = [
  '/perfil',
  '/adminboard',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ===== CONFIGURACIÓN DE HEADERS DE SEGURIDAD =====
  const response = NextResponse.next();

  // Content Security Policy
  const backendUrl = process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_API_URL || 'https://api.midominio.com'
    : 'http://localhost:5000';

  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self' ${backendUrl}; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob: https://res.cloudinary.com https://lh3.googleusercontent.com; media-src 'self' blob: https://res.cloudinary.com; connect-src 'self' ${backendUrl} https://api.cloudinary.com https://accounts.google.com https://oauth2.googleapis.com https://apis.google.com; worker-src 'self' blob:; frame-src 'self' https://accounts.google.com;`
  );

  // ===== MANTENIMIENTO =====
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

  if (isMaintenanceMode) {
    // Definir qué rutas estáticas PERMITIR (whitelist)
    const isStaticAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/images') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.css') ||
      pathname.endsWith('.js') ||
      pathname.endsWith('.json') ||
      pathname.endsWith('.woff') ||
      pathname.endsWith('.woff2');

    const isMaintenancePage = pathname === '/maintenance';

    // Si NO es asset estático NI la página de mantenimiento -> Redirigir a mantenimiento
    if (!isStaticAsset && !isMaintenancePage) {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  } else {
    // Si NO estamos en mantenimiento, redirigir /maintenance a home
    if (pathname === '/maintenance') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ===== AUTENTICACIÓN ACTIVADA =====
  // Rate limiting para rutas protegidas
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }
  }

  // Obtener token JWT con opciones mejoradas para producción
  let token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });


  // Verificar si la ruta requiere autenticación
  const requiresAuth = AUTH_REQUIRED_ROUTES.some(route => pathname.startsWith(route));

  if (requiresAuth) {
    if (!token) {
      // En producción puede haber un delay en la sincronización del token
      // Reintentar una vez antes de redirigir para evitar race conditions
      // Esperar un poco más en producción
      if (process.env.NODE_ENV === 'production') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production',
      });

    }
  }

  // Verificar si la ruta requiere rol de administrador
  const requiresAdmin = ADMIN_REQUIRED_ROUTES.some(route => pathname.startsWith(route));

  if (requiresAdmin) {
    if (!token) {
      // No autenticado, redirigir al home
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }

    if (token.role !== 'admin') {
      // No es admin, redirigir al home
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Verificar si la ruta requiere verificación de email
  const requiresEmailVerification = EMAIL_VERIFICATION_REQUIRED_ROUTES.some(route => pathname.startsWith(route));

  if (requiresEmailVerification && token) {
    // Si el usuario no tiene email verificado, redirigir a página de verificación
    if (!token.emailVerified) {
      const verificationUrl = new URL('/autenticacion/verificar-email', request.url);
      return NextResponse.redirect(verificationUrl);
    }
  }

  // ===== REDIRECCIÓN DE RUTAS DE FILTROS A RUTAS AMIGABLES =====
  // Este bloque captura rutas que empiezan con /filtros/ y redirige a /categoria[/departamento][/ciudad]
  if (pathname.startsWith('/filtros/')) {
    const url = request.nextUrl;
    // /filtros/escort  => split -> ["", "filtros", "escort"]
    const parts = url.pathname.split('/');
    const categoria = parts[2]; // puede ser undefined si /filtros/ solo
    const departamento = url.searchParams.get('departamento') ?? undefined;
    const ciudad = url.searchParams.get('ciudad') ?? undefined;

    // Only redirect if valid category (prevenir redirecciones inseguras)
    if (categoria && VALID_CATEGORIES.includes(categoria)) {
      // Build path: /categoria, /categoria/departamento, /categoria/departamento/ciudad
      const segs = [categoria, departamento, ciudad].filter(Boolean);
      const newPath = `/${segs.join('/')}`;
      return NextResponse.redirect(new URL(newPath, request.url));
    }
  }

  // ===== LÓGICA DE RUTAS DINÁMICAS (ORIGINAL) =====

  // Excluir archivos estáticos y rutas especiales inmediatamente
  if (pathname.includes('.') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.includes('installHook') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.map') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg')
  ) {
    return NextResponse.next();
  }

  // Solo procesar rutas que coincidan con el patrón de slug dinámico
  const slugMatch = pathname.match(/^\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);

  if (slugMatch) {
    const [, categoria, departamento, ciudad] = slugMatch;

    // Excluir rutas que no son de búsqueda/filtrado
    if (EXCLUDED_ROUTES.includes(categoria)) {
      return NextResponse.next();
    }

    // Verificar si es una ruta de categoría válida o de departamento
    if (categoria && !VALID_CATEGORIES.includes(categoria)) {
      // Si es un departamento válido, permitir la URL sin redirigir
      if (VALID_DEPARTMENTS.includes(categoria)) {
        // Permitir URLs del tipo /departamento o /departamento/ciudad
        return NextResponse.next();
      }
      // Si no es ni categoría ni departamento válido, continuar al 404
      return NextResponse.next();
    }

    // Verificar departamento si está presente
    if (departamento && !VALID_DEPARTMENTS.includes(departamento)) {
      return NextResponse.next();
    }
  }

  // Headers de seguridad adicionales
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml (SEO files)
     * - images (static images)
     * - placeholder files
     * - autenticacion (auth pages)
     * - perfil, adminboard (protected pages)
     * - buscar, faq, precios, etc. (static pages)
     * - file extensions (.js, .css, .map, etc.)
     * - installHook
     */
    '/((?!api/auth|_next/static|_next/image|favicon\.ico|robots\.txt|sitemap\.xml|images|placeholder|.*\.js\.map$|.*\.css\.map$|.*\.js$|.*\.css$|.*\.ico$|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.svg$|.*\.gif$|.*\.webp$|installHook).*)',
  ],
};