"""AUDITA PROSPECT — prepara a carga de audita.cnpj_companies (migração 20261120120000_p5_prospect_carteira): capital
social (arquivo Empresas*.zip da Receita) e número de estabelecimentos em SP por CNPJ básico, só das empresas-alvo já
preparadas por cnpj_carga.py. Não acessa o banco: só gera o arquivo.

Entrada (pasta da publicação, ex.: /home/deploy/audita/cnpj/2026-10):
  Empresas0..9.zip                (layout da Receita: cnpj_basico;razao;natureza;qualificacao;capital_social;porte;ente)
  sp/carga_estabelecimentos.csv.gz (de cnpj_carga.py)
Saída: sp/carga_empresas.csv.gz  cnpj_base, capital_social, establishments, publication
Uso: python3 cnpj_empresas.py <pasta> <AAAA-MM>
"""
import csv, gzip, io, os, re, sys, zipfile
from collections import Counter

D, REF = sys.argv[1], sys.argv[2]
SP = os.path.join(D, "sp")
csv.field_size_limit(10_000_000)

# Estabelecimentos-alvo por CNPJ básico (o arquivo já tem só as empresas-alvo de SP)
est = Counter()
with gzip.open(os.path.join(SP, "carga_estabelecimentos.csv.gz"), "rt", encoding="utf-8") as gz:
    rd = csv.reader(gz); next(rd)
    for r in rd:
        est[r[0][:8]] += 1
print("CNPJ básicos:", len(est), flush=True)

CAP = re.compile(r"^\d{1,16}(,\d{1,2})?$")
cap = {}
for i in range(10):
    z = zipfile.ZipFile(os.path.join(D, f"Empresas{i}.zip"))
    with z.open(z.namelist()[0]) as fh:
        for r in csv.reader(io.TextIOWrapper(fh, encoding="latin-1", newline=""), delimiter=";"):
            if len(r) >= 5 and r[0] in est:
                v = r[4].strip()
                cap[r[0]] = v.replace(",", ".") if CAP.match(v) else ""
    print("Empresas", i, len(cap), flush=True)

with gzip.open(os.path.join(SP, "carga_empresas.csv.gz"), "wt", encoding="utf-8", newline="") as out:
    w = csv.writer(out, lineterminator="\n")
    w.writerow(["cnpj_base", "capital_social", "establishments", "publication"])
    for b, n in est.items():
        w.writerow([b, cap.get(b, ""), n, REF])
print("FIM", len(est), "sem capital:", sum(1 for b in est if not cap.get(b)), flush=True)
