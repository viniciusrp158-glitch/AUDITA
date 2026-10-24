# Site institucional (raiz de audita.seg.br) — imagem para a VPS. Mesmas dependências do sistema; o site fica na pasta
# site/ e compila com `next build site` em páginas estáticas (site/out), servidas por um Nginx enxuto.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY eslint.config.mjs ./
COPY site ./site
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build site

FROM nginx:1.27-alpine
COPY deploy/vps/site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/site/out /usr/share/nginx/html
EXPOSE 8080
