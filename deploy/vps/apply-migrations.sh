#!/bin/sh
# Sistema AUDITA de Operação — aplica as migrações pendentes no Supabase self-hosted do AUDITA (container audita-db)
# e registra cada uma em supabase_migrations.schema_migrations, com a mesma versão do repositório (CLAUDE.md regra 3).
# Uso na VPS: sh /opt/audita-sistema/apply-migrations.sh (migrações copiadas para /opt/audita-sistema/supabase/migrations).
set -e
DIR=/opt/audita-sistema/supabase/migrations
PSQL="docker exec -i audita-db psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1"
$PSQL -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);" >/dev/null
for f in $(ls $DIR/*.sql | sort); do
  b=$(basename $f .sql); v=${b%%_*}; n=${b#*_}
  done_=$($PSQL -tA -c "select 1 from supabase_migrations.schema_migrations where version = '$v'")
  [ "$done_" = "1" ] && continue
  echo "-> $b"
  { echo "begin;"; cat $f; echo; echo "insert into supabase_migrations.schema_migrations(version, name) values ('$v', '$n');"; echo "commit;"; } | $PSQL >/dev/null
done
echo "ok: $($PSQL -tA -c "select count(*) from supabase_migrations.schema_migrations") migrações registradas"
