#!/bin/bash
# Sistema AUDITA de Operação — monta o ambiente de TESTES (dados fictícios) na VPS, separado da produção.
# Pasta própria (~/audita/supabase-audita-dev), containers auditadev-*, API só em 127.0.0.1:8200 (acesso por túnel SSH),
# chaves e senhas NOVAS (geradas aqui; nenhuma da produção) e banco vazio (as migrações são aplicadas depois).
# Liga só o necessário: banco, login, API, arquivos, funções e caixa de e-mails de teste (~0,9 GB de memória).
# Uso (root): bash montar-ambiente-testes.sh        Desligar: cd ~/audita/supabase-audita-dev && docker compose down
set -euo pipefail
P=/home/deploy/audita/supabase-audita
D=/home/deploy/audita/supabase-audita-dev
[ -e "$D/.env" ] && { echo "já existe: $D (nada alterado)"; exit 0; }
mkdir -p "$D"
# Configuração da instalação do AUDITA, sem dados (banco e arquivos) e sem o .env da produção
rsync -a --exclude 'volumes/db/data' --exclude 'volumes/storage' --exclude '.env' --exclude '.env.*' --exclude '*.bak*' --exclude '*.old' "$P/" "$D/"
mkdir -p "$D/volumes/storage"
# .env: estrutura da produção com TODOS os segredos trocados
grep -v -E '^(POSTGRES_PASSWORD|JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY|JWT_KEYS|JWT_JWKS|ANON_KEY_ASYMMETRIC|SERVICE_ROLE_KEY_ASYMMETRIC|DASHBOARD_PASSWORD|SECRET_KEY_BASE|REALTIME_DB_ENC_KEY|VAULT_ENC_KEY|PG_META_CRYPTO_KEY|LOGFLARE_[A-Z_]*|S3_PROTOCOL_[A-Z_]*|MINIO_ROOT_PASSWORD|SMTP_[A-Z]*|OPENAI_API_KEY|VITRINE_CHAVE_INTERNA|COMPOSE_FILE|SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|SITE_URL|ADDITIONAL_REDIRECT_URLS|POOLER_TENANT_ID|STORAGE_TENANT_ID|ENABLE_EMAIL_AUTOCONFIRM)=' "$P/.env" > "$D/.env"
cat >> "$D/.env" <<EOF
COMPOSE_FILE=docker-compose.yml:dev/docker-compose.dev.yml
SUPABASE_PUBLIC_URL=http://localhost:8200
API_EXTERNAL_URL=http://localhost:8200
SITE_URL=http://localhost:3137/empresa
ADDITIONAL_REDIRECT_URLS=http://localhost:3137/empresa/auth/confirm,http://localhost:3001/treinamentos
POOLER_TENANT_ID=auditadev
STORAGE_TENANT_ID=auditadev
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=nao-responda@exemplo.test
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=teste
SMTP_PASS=teste
SMTP_SENDER_NAME=AUDITA (testes)
OPENAI_API_KEY=
VITRINE_CHAVE_INTERNA=$(openssl rand -hex 24)
EOF
cd "$D"
sh utils/generate-keys.sh --update-env >/dev/null
grep -q '^POSTGRES_PASSWORD=' .env || echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
grep -q '^DASHBOARD_PASSWORD=' .env || echo "DASHBOARD_PASSWORD=$(openssl rand -hex 16)" >> .env
sh utils/add-new-auth-keys.sh --update-env >/dev/null
chmod 600 .env
chown -R deploy:deploy "$D"
docker compose up -d db
for i in $(seq 1 60); do docker exec auditadev-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 3; done
docker compose up -d auth rest api-gw storage imgproxy functions mailpit
sleep 20
docker compose ps --format '{{.Name}} {{.Status}}'
