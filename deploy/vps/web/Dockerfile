# Sistema AUDITA de Operação — imagem do site (Next.js com servidor) para a VPS.
# As variáveis NEXT_PUBLIC_* entram no build (o Next as grava no código do navegador) e também no container (servidor).
# Nenhum segredo: a URL da API e a chave publicável não são privilegiadas.
# Imagem enxuta (output "standalone"): leva só o servidor e os arquivos que ele usa, não o node_modules inteiro.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_ENV=producao
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# poppler-utils: pdftotext, usado na leitura das questões dos gabaritos (Treinamentos)
RUN apk add --no-cache tzdata poppler-utils
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=America/Sao_Paulo PORT=3200 HOSTNAME=0.0.0.0
# .next pertence ao usuário node: o otimizador de imagens grava em .next/cache/images (sem permissão, a conversão
# para WebP/AVIF trava e o logo não aparece)
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3200
CMD ["node", "server.js"]
