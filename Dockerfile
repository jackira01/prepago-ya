# Usa la imagen ligera de Bun 2026
FROM oven/bun:1.2-slim AS base
WORKDIR /app

# Copiamos archivos de configuración (Asegúrate de tener bun.lockb)
COPY package.json bun.lockb ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Instalamos dependencias de todo el monorepo
RUN bun install --frozen-lockfile

# Copiamos el resto del código
COPY . .

# Construimos el backend (y el frontend si lo despliegas aquí)
RUN bun run build:backend

# Etapa de ejecución
FROM oven/bun:1.2-slim AS release
WORKDIR /app

# Copiamos solo lo necesario desde la etapa de build
COPY --from=base /app/backend/dist ./backend/dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/backend/package.json ./backend/package.json

# Variable de entorno para producción
ENV NODE_ENV=production

EXPOSE 5000

# Ejecutamos con el runtime de Bun
CMD ["bun", "run", "backend/dist/server.js"]