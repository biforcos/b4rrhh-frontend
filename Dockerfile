# ── Etapa 1: construir la SPA ────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# El cliente del contrato se genera aqui dentro, y openapi-generator es una
# herramienta Java por debajo. Sin esta linea, esta imagen solo se construye
# en una maquina que YA tenga el cliente generado en disco, que es como se
# venia construyendo sin que se notara: los ficheros generados estan en
# .gitignore pero se colaban en el contexto de build.
RUN apk add --no-cache openjdk21-jre-headless

# package*.json primero: mientras no cambien las dependencias, Docker
# reutiliza la capa del npm ci, que es la que tarda.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Contract-first: el cliente sale del contrato, no del repositorio.
RUN npm run api:generate
RUN npm run build

# ── Etapa 2: servir ──────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# El builder @angular/build:application deja el resultado en browser/.
COPY --from=build /app/dist/b4rrhh-frontend/browser /usr/share/nginx/html

EXPOSE 80
