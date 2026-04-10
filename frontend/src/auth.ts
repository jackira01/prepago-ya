import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

class GoogleOnlySignInError extends CredentialsSignin {
  code = "google_only_account";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Faltan credenciales");
        }

        try {
          // Usar el endpoint del backend para login
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const result = await response.json();

          if (!result.success) {
            if (result.provider === 'google') {
              throw new GoogleOnlySignInError();
            }
            throw new Error(result.message || "Credenciales inválidas");
          }

          // Limpiar intentos fallidos en caso de éxito
          if (req) {
            // TODO: Implementar limpieza de intentos fallidos si es necesario
          }
          return {
            id: result.user._id,
            email: result.user.email,
            name: result.user.name,
            isVerified: result.user.isVerified,
            verification_in_progress: result.user.verification_in_progress,
            role: result.user.role,
            hasPassword: true,
            emailVerified: result.user.emailVerified,
            provider: "credentials",
            accessToken: result.token // Capturar el token del backend
          };
        } catch (error) {
          // Re-lanzar CredentialsSignin subclasses sin envolver para que
          // @auth/core las reconozca correctamente y propague el code al cliente
          if (error instanceof CredentialsSignin) throw error;
          throw new Error(error instanceof Error ? error.message : "Error de autenticación");
        }
      },
    }),
  ],

  // Configuración de páginas personalizadas
  pages: {
    signIn: '/autenticacion/ingresar',
    error: '/autenticacion/error',
  },

  // Usar JWT para mejor compatibilidad con Credentials
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },



  callbacks: {
    async signIn({ user, account, profile }) {
      // Manejar login con Google
      if (account?.provider === 'google') {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/auth_google`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              image: user.image,
              googleId: user.id
            })
          });

          const result = await response.json();

          if (!result.success) {
            console.error('❌ [NEXTAUTH SIGNIN] Google auth failed:', result.message);
            return false;
          }

          // Actualizar el objeto user con los datos del backend
          user.id = result.user._id;
          user._id = result.user._id;
          user.isVerified = result.user.isVerified;
          user.verification_in_progress = result.user.verification_in_progress;
          user.role = result.user.role;
          user.hasPassword = result.user.hasPassword;
          user.emailVerified = result.user.emailVerified;
          user.accessToken = result.token; // Capturar el token del backend

          return true;
        } catch (error) {
          console.error('❌ [NEXTAUTH SIGNIN] Error in Google auth:', error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Solo mantener logs críticos para debugging de producción
      if (user) {
        token.id = user.id || '';
        token._id = user._id || user.id || '';
        token.email = user.email || '';
        token.name = user.name || '';
        token.image = user.image || '';
        token.isVerified = user.isVerified ?? false;
        token.verification_in_progress = user.verification_in_progress ?? false;
        token.role = user.role || 'guest';
        token.hasPassword = user.hasPassword ?? false;
        token.emailVerified = user.emailVerified ?? null;
        token.profileId = user.profileId;
        token.profileStatus = user.profileStatus;
        token.profileVerificationStatus = user.profileVerificationStatus;
        token.isHighlighted = user.isHighlighted ?? false;
        token.highlightedUntil = user.highlightedUntil;
        // Guardar accessToken si existe
        if (user.accessToken) {
          token.accessToken = user.accessToken;
        }
      }

      // CRÍTICO: Solo actualizar en trigger 'update' explícito, no en cada petición
      if (trigger === 'update' && token.id) {

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
          const fetchUrl = `${apiUrl}/api/users/${token.id}`;

          const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });


          if (response.ok) {
            const userData = await response.json();
            // Actualizar token con nuevos valores
            const oldHasPassword = token.hasPassword;
            token.hasPassword = userData.hasPassword;
            token.isVerified = userData.isVerified;
            token.verification_in_progress = userData.verification_in_progress;
            token.role = userData.role;
            token.emailVerified = userData.emailVerified;
            token.profileId = userData.profileId;
            token.profileStatus = userData.profileStatus;
            token.profileVerificationStatus = userData.profileVerificationStatus;
            token.isHighlighted = userData.isHighlighted;
            token.highlightedUntil = userData.highlightedUntil;

          } else {
            console.error('❌ [NEXTAUTH JWT] Failed to fetch user data:', response.status);
            const errorText = await response.text();
            console.error('❌ [NEXTAUTH JWT] Error response:', errorText);
          }
        } catch (error) {
          console.error('❌ [NEXTAUTH JWT] Error fetching user data:', error);
        }
      }

      if (account?.provider) {
        token.provider = account.provider;
      }
      return token;
    },

    async session({ session, token }) {

      // Transferir datos del token a la sesión
      if (token) {
        session.user.id = token.id as string;
        session.user._id = token.id as string; // Agregar _id para compatibilidad
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
        session.user.isVerified = token.isVerified as boolean;
        session.user.verification_in_progress = token.verification_in_progress as boolean;
        session.user.role = token.role as 'admin' | 'user' | 'guest';
        session.user.hasPassword = token.hasPassword as boolean;
        session.user.emailVerified = token.emailVerified as Date | null;
        session.user.provider = token.provider as string;
        session.user.profileId = token.profileId as string;
        session.user.profileStatus = token.profileStatus as string;
        session.user.profileVerificationStatus = token.profileVerificationStatus as string;
        session.user.isHighlighted = token.isHighlighted as boolean;
        session.user.highlightedUntil = token.highlightedUntil as string;
        session.user.accessToken = token.accessToken as string; // Pasar accessToken a la sesión
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Siempre redirigir a / después del login exitoso
      return `${baseUrl}/`;
    },
  },

  // Configuración de debug deshabilitada para evitar logs en consola
  debug: false,
  secret: process.env.NEXTAUTH_SECRET,
});