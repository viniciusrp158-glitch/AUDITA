#!/bin/bash
# Publica uma revisão na Biblioteca do AUDITA (roda no servidor). Uso: publicar.sh DOC_CODE REV ARQUIVO NOTAS
set -euo pipefail
DOC="$1"; REV="$2"; FILE="$3"; NOTES="$4"
DIRETOR="31c99f0e-eca4-4430-9764-642304281358"
NAME=$(basename "$FILE")
DOCID=$(docker exec -i audita-db psql -U postgres -At -c "select id from audita.library_documents where doc_code='$DOC'")
[ -n "$DOCID" ] || { echo "documento $DOC não encontrado"; exit 1; }
SPATH="library/$DOCID/rev${REV#Rev.}/$(date +%s%3N)_$NAME"
SHA=$(sha256sum "$FILE" | cut -d' ' -f1)
SIZE=$(stat -c %s "$FILE")
MIME="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
KEY=$(grep '^SERVICE_ROLE_KEY=' /home/deploy/audita/supabase-audita/.env | cut -d= -f2-)
HTTP=$(curl -s -o /tmp/up.json -w '%{http_code}' -X POST "http://127.0.0.1:8100/storage/v1/object/audita-biblioteca/$SPATH" \
  -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: $MIME" -H "x-upsert: false" --data-binary "@$FILE")
echo "upload: $HTTP $(cat /tmp/up.json)"
[ "$HTTP" = "200" ] || exit 1
HOJE=$(TZ=America/Sao_Paulo date +%F)
docker exec -i audita-db psql -U postgres -v ON_ERROR_STOP=1 -At \
  -v docid="$DOCID" -v rev="$REV" -v spath="$SPATH" -v name="$NAME" -v mime="$MIME" -v size="$SIZE" -v sha="$SHA" -v notes="$NOTES" -v hoje="$HOJE" <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$DIRETOR","role":"authenticated"}', true);
insert into audita.library_revisions (document_id, revision, approved_by, approved_on, issued_on, storage_path, original_name, mime_type, size_bytes, sha256, notes)
  values (:'docid', :'rev', 'Vinicius Rocha Pereira — Diretor', :'hoje', :'hoje', :'spath', :'name', :'mime', :'size', :'sha', :'notes')
  returning id as revid \gset
select audita.publish_library_revision(:'revid');
commit;
select revision||' '||status||' '||to_char(published_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') from audita.library_revisions where document_id=:'docid' order by revision;
SQL
