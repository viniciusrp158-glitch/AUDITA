#!/bin/bash
# Baixa a base pública de CNPJ (Receita Federal, dados abertos) — só os arquivos usados pelo AUDITA PROSPECT.
# Uso: baixar-cnpj.sh AAAA-MM. O servidor da Receita limita cada conexão (~0,5 MB/s): baixa 6 arquivos em paralelo,
# com baixa prioridade e retomada; arquivos já completos (tamanho igual ao publicado) são pulados.
set -u
MES="$1"
export T=gn672Ad4CF8N6TK
export B="https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ/$MES"
export D=/home/deploy/audita/cnpj/$MES
mkdir -p "$D"; cd "$D"
baixar() {
  f="$1"
  for t in 1 2 3 4 5 6; do
    nice -n 19 ionice -c3 curl -s -f -C - -m 7200 -u "$T:" -o "$D/$f" "$B/$f" && { echo "$(date +%T) ok $f $(stat -c %s "$D/$f")"; return 0; }
    echo "$(date +%T) falha $f tentativa $t"; sleep 30
  done
  echo "$(date +%T) DESISTIU $f"
}
export -f baixar
LIST="Cnaes.zip Municipios.zip Naturezas.zip Motivos.zip"
for i in 0 1 2 3 4 5 6 7 8 9; do LIST="$LIST Estabelecimentos$i.zip Empresas$i.zip"; done
printf "%s\n" $LIST | xargs -P 6 -I{} bash -c 'baixar {}'
echo "$(date +%T) FIM"
