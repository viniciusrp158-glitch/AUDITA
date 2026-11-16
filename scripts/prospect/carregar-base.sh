#!/bin/bash
# AUDITA PROSPECT — carrega no banco a publicação mensal da base pública de CNPJ (recorte de SP já preparado por
# cnpj_carga.py). Roda no servidor, como root, DEPOIS do backup e da migração 20261114120000_p1_prospect.
# Tudo numa transação: se algo falhar, a base anterior continua valendo.
# A tabela audita.cnpj_establishments é um espelho recarregável de dados públicos (não é cadastro do AUDITA):
# cada carga substitui o conteúdo inteiro e registra a publicação usada.
# Uso: carregar-base.sh AAAA-MM
set -euo pipefail
REF="$1"
D=/home/deploy/audita/cnpj/$REF/sp
[ -s "$D/carga_estabelecimentos.csv.gz" ] && [ -s "$D/carga_municipios.csv" ] || { echo "arquivos de carga ausentes em $D"; exit 1; }
LINHAS=$(python3 -c "import json;print(json.load(open('$D/carga_resumo.json'))['linhas'])")

{
  echo "\\set ON_ERROR_STOP on"
  echo "begin;"
  echo "insert into audita.cnpj_publications (reference, source, rows_loaded, is_current, notes)
        values ('$REF', 'Receita Federal — dados abertos do CNPJ (arquivos.receitafederal.gov.br)', $LINHAS, false,
                'Recorte: SP, estabelecimentos ativos, sem empresário individual/MEI')
        on conflict (reference) do update set rows_loaded = excluded.rows_loaded, loaded_at = now();"
  echo "create temp table stg_mun (ibge_code text, name text, uf text, rfb_code text, lat numeric, lon numeric, km_from_base numeric, immediate_region text);"
  echo "copy stg_mun from stdin with (format csv, header true);"
  cat "$D/carga_municipios.csv"
  echo '\.'
  echo "insert into audita.ibge_municipalities (ibge_code, name, uf, rfb_code, lat, lon, km_from_base, immediate_region)
        select ibge_code, name, uf, nullif(rfb_code, ''), lat, lon, km_from_base, immediate_region from stg_mun
        on conflict (ibge_code) do update set name = excluded.name, rfb_code = excluded.rfb_code, lat = excluded.lat,
          lon = excluded.lon, km_from_base = excluded.km_from_base, immediate_region = excluded.immediate_region;"
  echo "delete from audita.cnpj_establishments;"
  echo "copy audita.cnpj_establishments (cnpj, is_headquarters, legal_name, trade_name, legal_nature, size_code, started_on,
          cnae_main, cnae_secondary, street, number, complement, district, zip, ibge_code, phone1, phone2, email, publication)
        from stdin with (format csv, header true, null '');"
  zcat "$D/carga_estabelecimentos.csv.gz"
  echo '\.'
  echo "update audita.cnpj_publications set is_current = false where is_current and reference <> '$REF';"
  echo "update audita.cnpj_publications set is_current = true where reference = '$REF';"
  echo "select 'carregados: ' || count(*) from audita.cnpj_establishments;"
  echo "commit;"
  echo "analyze audita.cnpj_establishments;"
} | docker exec -i audita-db psql -U postgres -At
