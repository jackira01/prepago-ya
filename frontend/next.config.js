/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  // 📦 Evita advertencias por tracing
  outputFileTracingRoot: path.join(__dirname, "../"),

  // ⚙️ Compilación más tolerante para producción
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // 🧹 Limpieza de consola en producción
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // 🖼️ Configuración de imágenes optimizada
  images: {
    domains: [
      "res.cloudinary.com",
      "images.unsplash.com",
      "via.placeholder.com",
    ],
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
  },

  compress: true,

  // 🧱 Headers de seguridad
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },

  // 🔁 API rewrites
  async rewrites() {
    return [
      {
        source: "/api/((?!auth).*)/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
          }/api/$1/:path*`,
      },
    ];
  },

  // 🧱 Opciones experimentales válidas
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@tanstack/react-query",
      "framer-motion",
    ],
    webVitalsAttribution: ["CLS", "LCP"],
    optimizeServerReact: true,
    serverMinification: true,
    serverSourceMaps: false,
  },

  // 🚀 Paquetes externos del servidor (Next.js 13+)
  serverExternalPackages: [
    "@editorjs/editorjs",
    "@editorjs/header",
    "@editorjs/list",
    "@editorjs/image",
    "@editorjs/quote",
    "@editorjs/embed",
    "editorjs-react-renderer",
    "browser-image-compression",
  ],

  // 🧱 Configuración avanzada de Webpack
  webpack: (config, { dev, isServer }) => {
    // 🔑 Cambiar globalObject para evitar 'self' en el servidor
    if (isServer) {
      config.output = config.output || {};
      config.output.globalObject = "globalThis";
    }

    // Fallbacks solo para el cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Alias globales
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };

    // 🔒 Externals simplificados para el servidor
    if (isServer) {
      // Agregar paquetes del cliente como externos (strings simples)
      const clientOnlyPackages = [
        "@editorjs/editorjs",
        "@editorjs/header",
        "@editorjs/list",
        "@editorjs/image",
        "@editorjs/quote",
        "@editorjs/embed",
        "editorjs-react-renderer",
        "browser-image-compression",
      ];

      // Forma correcta de agregar externals sin romper los existentes
      if (typeof config.externals === "function") {
        const originalExternals = config.externals;
        config.externals = async (context, request, callback) => {
          if (clientOnlyPackages.includes(request)) {
            return callback(null, `commonjs ${request}`);
          }
          return originalExternals(context, request, callback);
        };
      } else {
        config.externals = [
          ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
          ...clientOnlyPackages,
        ];
      }
    }

    // Optimización de chunks solo en producción
    if (!dev) {
      /* config.optimization.splitChunks = {
        chunks: "all",
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: -10,
            chunks: "all",
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: "react",
            priority: 20,
            chunks: "all",
          },
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|@headlessui)[\\/]/,
            name: "ui",
            priority: 15,
            chunks: "all",
          },
          utils: {
            test: /[\\/]node_modules[\\/](date-fns|lodash|clsx)[\\/]/,
            name: "utils",
            priority: 10,
            chunks: "all",
          },
        },
      }; */
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    return config;
  },

  // 🌍 Variables de entorno
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Scort Web Site",
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "1.0.0",
  },

  // 🔀 Redirecciones automáticas
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: true,
      },
    ];
  },

  trailingSlash: false,
  poweredByHeader: false,
  reactStrictMode: true,
};

module.exports = nextConfig;