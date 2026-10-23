# Área do aluno dos treinamentos (audita.seg.br/treinamentos) — imagem para a VPS. Mesmas dependências do sistema;
# o app fica na pasta aluno/ e compila com `next build aluno`. NEXT_PUBLIC_* entram no build (código do navegador).
# Imagem enxuta (output "standalone"): o servidor fica em aluno/server.js, com só as dependências que ele usa.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY aluno ./aluno
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npx next build aluno

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tzdata
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=America/Sao_Paulo PORT=3300 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/aluno/.next/standalone ./
COPY --from=build --chown=node:node /app/aluno/.next/static ./aluno/.next/static
COPY --from=build /app/aluno/public ./aluno/public
USER node
EXPOSE 3300
CMD ["node", "aluno/server.js"]
