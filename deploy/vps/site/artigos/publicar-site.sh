#!/usr/bin/env bash
# Publica o site institucional na VPS a partir do commit atual (HEAD). Uso: bash deploy/vps/site/artigos/publicar-site.sh <TAG>
# Só o site (container audita-site). Testa a imagem numa porta privada antes de trocar e guarda cópia do .env para voltar.
set -euo pipefail
T="${1:?informe a tag, ex.: 20261208-artigo}"
VPS=deploy@164.68.112.61
ARQ="${TEMP:-/tmp}/site-$T.tgz"
git archive --format=tar.gz -o "$ARQ" HEAD deploy package.json package-lock.json eslint.config.mjs site
scp -q "$ARQ" "$VPS:/tmp/"
ssh "$VPS" bash -s "$T" <<'REMOTO'
set -euo pipefail
T="$1"; cd ~/audita/audita-sistema
mkdir -p "releases/$T" && tar xzf "/tmp/site-$T.tgz" -C "releases/$T"
cd "releases/$T"
# next/font baixa as fontes do Google no build e às vezes falha por rede: até 3 tentativas
for n in 1 2 3; do
  if docker build --progress=plain -f deploy/vps/site/Dockerfile -t "audita-site:$T" . > "/tmp/build-$T.log" 2>&1; then echo "build ok ($n)"; break; fi
  echo "build falhou ($n)"; [ "$n" = 3 ] && { tail -30 "/tmp/build-$T.log"; exit 1; }; sleep 30
done
docker rm -f site-teste >/dev/null 2>&1 || true
docker run -d --name site-teste -p 127.0.0.1:3499:8080 "audita-site:$T" >/dev/null; sleep 3
for u in / /artigos/ /sitemap.xml; do c=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3499$u"); echo "teste $u $c"; [ "$c" = 200 ] || { docker rm -f site-teste >/dev/null; exit 1; }; done
docker rm -f site-teste >/dev/null
cd ~/audita/audita-sistema
cp .env ".env.bak-$T"
sed -i "s/^AUDITA_SITE_TAG=.*/AUDITA_SITE_TAG=$T/" .env
docker compose up -d site
REMOTO
sleep 5
for u in / /artigos/ /sitemap.xml; do c=$(curl -s -o /dev/null -w '%{http_code}' "https://audita.seg.br$u"); echo "público $u $c"; [ "$c" = 200 ] || exit 1; done
echo "publicado: audita-site:$T"
