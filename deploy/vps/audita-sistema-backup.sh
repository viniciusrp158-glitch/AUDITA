#!/bin/sh
# Backup diário do Sistema AUDITA de Operação (/usr/local/bin/audita-sistema-backup): dump do Postgres do AUDITA
# (inclui auth), arquivos do Storage, .env do Supabase e variáveis do site. Mantém 14 dias. Agendado às 04h00 em
# /etc/cron.d/audita-sistema-backup (o do Audita PRO roda às 03h30). Copie periodicamente para fora da VPS.
set -e
umask 077
D=/var/backups/audita-sistema; T=$(date +%F_%H%M); mkdir -p $D
docker exec audita-db pg_dumpall -U supabase_admin --clean --if-exists | gzip -9 > $D/db_$T.sql.gz
tar -czf $D/storage_$T.tar.gz -C /opt/supabase-audita/volumes storage
cp /opt/supabase-audita/.env $D/env_$T
cp /opt/audita-sistema/web.env $D/web-env_$T
find $D -type f -mtime +14 -delete
echo "$(date -Is) ok $(du -sh $D | cut -f1)" >> /var/log/audita-sistema-backup.log
