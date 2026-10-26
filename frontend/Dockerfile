# 1. Construction de l'application Angular avec Node
FROM node:22.15.1-alpine AS build
WORKDIR /app

# Dépendances d'abord, pour profiter du cache Docker.
# L'échiquier (ngx-chess-board) s'installe depuis le dossier projects/ : il doit être copié avant npm ci
COPY package.json package-lock.json ./
COPY projects/ ./projects/
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# 2. Un petit serveur web nginx sert les fichiers construits
FROM nginx:1.28.0-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/chess-board /usr/share/nginx/html
EXPOSE 80
