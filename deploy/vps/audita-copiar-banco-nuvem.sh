#!/bin/bash
# Sistema AUDITA — migração para a VPS (guia, passo 4): copia os DADOS do banco audita-dev em nuvem (esquema audita e
# usuários do login) para arquivos em /root, para serem carregados no Supabase do AUDITA na VPS.
# Só lê a nuvem. Pede a senha do banco na tela (não aparece) e não a grava em lugar nenhum.
# Uso (o Diretor, no terminal do computador dele): ssh -t root@164.68.112.61 audita-copiar-banco-nuvem
set -e
REF=avfqgxckcclzktrojynj
echo "Cópia dos dados do banco audita-dev (nuvem) para a VPS. Nada é alterado na nuvem."
read -rsp "Senha do banco de dados do audita-dev (não aparece na tela): " SENHA
echo
[ -n "$SENHA" ] || { echo "Senha vazia. Nada foi feito."; exit 1; }
SENHA_URL=$(printf '%s' "$SENHA" | jq -sRr @uri)
unset SENHA
URL=""
for HOST in aws-0-sa-east-1.pooler.supabase.com aws-1-sa-east-1.pooler.supabase.com; do
  TESTE="postgresql://postgres.$REF:$SENHA_URL@$HOST:5432/postgres"
  if docker exec audita-db psql "$TESTE" -tAc "select 1" >/dev/null 2>&1; then URL="$TESTE"; break; fi
done
unset SENHA_URL TESTE
[ -n "$URL" ] || { echo "Não foi possível conectar. Confira a senha (Project Settings > Database) e tente de novo."; exit 1; }
echo "Conectado. Copiando..."
umask 077
docker exec audita-db pg_dump "$URL" --data-only -n audita -Fc > /root/migracao-audita.dump
docker exec audita-db pg_dump "$URL" --data-only -t auth.users -t auth.identities -Fc > /root/migracao-auth.dump
unset URL
ls -l /root/migracao-audita.dump /root/migracao-auth.dump
echo "Pronto. Pode avisar o Claude."
