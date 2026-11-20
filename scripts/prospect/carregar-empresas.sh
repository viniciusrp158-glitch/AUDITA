#!/bin/bash
# AUDITA PROSPECT — carrega audita.cnpj_companies (capital social e nº de estabelecimentos; arquivo de cnpj_empresas.py)
# e recalcula a carteira de oportunidades. Roda no servidor, como root, depois do backup e da migração
# 20261120120000_p5_prospect_carteira. Tudo numa transação: se algo falhar, a carga anterior continua valendo.
# A carga mensal da base (carregar-base.sh) deve ser seguida desta.
# Uso: carregar-empresas.sh AAAA-MM [container]   (container padrão: audita-db; ambiente de testes: auditadev-db)
set -euo pipefail
REF="$1"
DB="${2:-audita-db}"
F=/home/deploy/audita/cnpj/$REF/sp/carga_empresas.csv.gz
[ -s "$F" ] || { echo "arquivo ausente: $F"; exit 1; }
{
  echo "\\set ON_ERROR_STOP on"
  echo "begin;"
  echo "delete from audita.cnpj_companies;"
  echo "copy audita.cnpj_companies (cnpj_base, capital_social, establishments, publication) from stdin with (format csv, header true, null '');"
  zcat "$F" | tr -d '\r'
  echo '\.'
  echo "select 'empresas: ' || count(*) from audita.cnpj_companies;"
  echo "commit;"
  echo "vacuum analyze audita.cnpj_companies;"
  echo "select 'carteira: ' || audita.refresh_prospect_portfolio() || ' empresas';"
  echo "vacuum analyze audita.prospect_portfolio;"
} | docker exec -i "$DB" psql -U postgres -At
