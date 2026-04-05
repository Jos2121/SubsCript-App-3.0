FROM node:22-alpine

# Configurar zona horaria global para el contenedor Alpine
ENV TZ=America/Lima
RUN apk add --no-cache tzdata

WORKDIR /app

# Habilitar pnpm
RUN corepack enable pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN pnpm install

# Copiar el resto del código fuente
COPY . .

# Construir el frontend y backend (Ejecutando tsc y vite build)
RUN pnpm run build

# Exponer el puerto
EXPOSE 3000

# Iniciar la aplicación
CMD ["pnpm", "start"]