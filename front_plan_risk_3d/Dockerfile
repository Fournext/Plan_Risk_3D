# Etapa 1: Build de Angular SSR
FROM node:20-alpine AS build

WORKDIR /app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Construir Angular Universal (SSR)
RUN npm run build

# Etapa 2: Imagen final (solo runtime)
FROM node:20-alpine

WORKDIR /app

# Copiar dist y node_modules desde la etapa de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Exponer el puerto donde correrá SSR
EXPOSE 4000

# Comando para ejecutar el servidor SSR
CMD ["node", "dist/front_plan_risk_3d/server/server.mjs"]
