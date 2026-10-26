#!/bin/sh
# Copia para o computador o backup mais recente do Sistema AUDITA na VPS (pendência V5): banco, Storage, .env do Supabase,
# OBSOLETO desde 26/10/2026: os caminhos abaixo (/opt, /var/backups/audita-sistema) não existem mais. Os backups agora
# ficam em /home/deploy/backups (ver deploy/servidor/README.md).
# web.env e um pacote com as configurações do servidor. Roda no Git Bash, na pasta do projeto:
#   sh scripts/baixar-backup-vps.sh            (usa o backup das 04h00 mais recente)
#   sh scripts/baixar-backup-vps.sh agora      (gera um backup novo antes de baixar)
# Destino: ../AUDITA-BACKUP-VPS/<data>/ — FORA do repositório, porque contém dados pessoais e segredos. Nunca enviar ao Git.
# A rede da VPS perde pacotes: os arquivos grandes são baixados em pedaços de 200 KB (transferências maiores emperram nessa rede), com novas tentativas, e no fim tudo
# é conferido pelo SHA-256. A verificação da chave do servidor continua estrita (uma máquina estranha é recusada e o
# pedaço é tentado de novo).
set -e
VPS=root@164.68.112.61
B=/var/backups/audita-sistema
SSH="ssh -o BatchMode=yes -o ConnectTimeout=10"
SCP="scp -q -o BatchMode=yes -o ConnectTimeout=10"

remoto() { for t in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do $SSH $VPS "$1" 2>/dev/null && return 0; done; echo "Falhou na VPS: $1" >&2; exit 1; }
baixa() { for t in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do timeout 45 $SCP "$VPS:$1" "$2" 2>/dev/null && return 0; done; echo "Falhou o download: $1" >&2; exit 1; }

[ "$1" = "agora" ] && remoto "/usr/local/bin/audita-sistema-backup >>/var/log/audita-sistema-backup.log 2>&1"

T=$(remoto "ls -t $B/db_*.sql.gz | head -1" | sed 's/.*db_//;s/\.sql\.gz//')
echo "Backup: $T"
remoto "set -e; cd $B; umask 077
  tar -czf config_$T.tar.gz /etc/nginx/sites-available/audita-sistema /etc/cron.d/audita-sistema-backup \
    /usr/local/bin/audita-sistema-backup /usr/local/bin/audita-email /usr/local/bin/audita-copiar-banco-nuvem \
    /var/www/audita-email /opt/audita-sistema/.env /opt/audita-sistema/web.env /opt/audita-sistema/docker-compose.yml \
    /opt/audita-sistema/apply-migrations.sh /opt/supabase-audita/.env /opt/supabase-audita/.supabase-version \
    /opt/supabase-audita/docker-compose.yml /opt/supabase-audita/docker-compose.vps.yml /opt/supabase-audita/volumes/api \
    /opt/supabase-audita/volumes/functions /opt/supabase-audita/volumes/pooler /opt/supabase-audita/volumes/proxy \
    /opt/supabase-audita/volumes/logs 2>/dev/null
  sha256sum db_$T.sql.gz storage_$T.tar.gz env_$T web-env_$T config_$T.tar.gz > SHA256_$T.txt
  rm -rf partes_$T && mkdir -m 700 partes_$T && for f in db_$T.sql.gz storage_$T.tar.gz config_$T.tar.gz; do split -b 200k -d -a 3 \$f partes_$T/\$f.; done"

D="$(dirname "$0")/../../AUDITA-BACKUP-VPS/$T"
mkdir -p "$D/partes"
for f in SHA256_$T.txt env_$T web-env_$T; do baixa "$B/$f" "$D/"; done
for p in $(remoto "ls $B/partes_$T"); do
  [ -s "$D/partes/$p" ] || baixa "$B/partes_$T/$p" "$D/partes/"
  printf '.'
done
echo
for f in db_$T.sql.gz storage_$T.tar.gz config_$T.tar.gz; do cat "$D/partes/$f".* > "$D/$f"; done
rm -rf "$D/partes"
remoto "rm -rf $B/partes_$T"
(cd "$D" && sha256sum -c "SHA256_$T.txt")
echo "Backup copiado e conferido em: $(cd "$D" && pwd)"
