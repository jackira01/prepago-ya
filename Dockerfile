# ==========================================
# ETAPA 1: Instalación (Base)
# ==========================================
FROM oven/bun:1.2-slim AS base
WORKDIR /app

# Copiamos los manifiestos del monorepo
# Copiar el package.json del frontend es obligatorio para que Bun reconozca el workspace
COPY package.json bun.lockb* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Instalamos todas las dependencias
# Usamos --frozen-lockfile para asegurar que las versiones sean exactas
RUN bun install --frozen-lockfile

# ==========================================
# ETAPA 2: Construcción (Builder)
# ==========================================
FROM base AS builder
WORKDIR /app

# Copiamos el código fuente del backend y la config de TS de la raíz
COPY backend/ ./backend/
COPY tsconfig.json* ./

# Entramos a la carpeta del backend y compilamos
WORKDIR /app/backend
RUN bun run build:prod

# ==========================================
# ETAPA 3: Producción (Final)
# ==========================================
FROM oven/bun:1.2-slim AS production
WORKDIR /app

# Definimos que estamos en producción
ENV NODE_ENV=production
ENV PORT=5000

# Copiamos solo lo estrictamente necesario de las etapas anteriores
# 1. Las dependencias ya instaladas
COPY --from=base /app/node_modules ./node_modules
# 2. El código ya compilado (JS plano)
COPY --from=builder /app/backend/dist ./backend/dist
# 3. El package.json del backend para los scripts
COPY --from=builder /app/backend/package.json ./backend/package.json

# Seguridad: Crear un usuario sin privilegios de root para ejecutar la app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bunuser
USER bunuser

# Exponemos el puerto del backend
EXPOSE 5000

# Comando para iniciar la aplicación usando el runtime de Bun
# Apuntamos directamente al archivo compilado en dist
CMD ["bun", "run", "backend/dist/server.js"]