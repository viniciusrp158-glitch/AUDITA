"""AUDITA PROSPECT — Fase 0: recorte de SP da base pública de CNPJ (Receita Federal) e contagens para escolher nichos.
Lê os .zip direto (sem descompactar no disco). Saídas em <pasta>/sp/:
  estab_sp_ativos.csv.gz — estabelecimentos ativos (situação 02) em SP, colunas usadas pelo PROSPECT
  agregados.json         — contagens por CNAE, divisão CNAE, município, porte e canal de contato
Uso: python3 cnpj_sp.py /home/deploy/audita/cnpj/2026-10
"""
import csv, gzip, io, json, os, sys, zipfile
from collections import Counter, defaultdict

D = sys.argv[1]
OUT = os.path.join(D, "sp")
os.makedirs(OUT, exist_ok=True)
csv.field_size_limit(10_000_000)


def rows(name):
    z = zipfile.ZipFile(os.path.join(D, name))
    with z.open(z.namelist()[0]) as fh:
        yield from csv.reader(io.TextIOWrapper(fh, encoding="latin-1", newline=""), delimiter=";")


cnaes = {r[0]: r[1] for r in rows("Cnaes.zip")}
municipios = {r[0]: r[1] for r in rows("Municipios.zip")}

# 1) Estabelecimentos ativos em SP
COLS = ["cnpj", "matriz", "fantasia", "inicio", "cnae", "cnae_sec", "tipo_log", "logradouro", "numero", "complemento",
        "bairro", "cep", "municipio", "tel1", "tel2", "email"]
basicos = set()
by_cnae = Counter(); by_div = Counter(); by_mun = Counter(); by_mun_div = defaultdict(Counter)
contato = Counter(); abertos_12m = Counter(); total = 0
with gzip.open(os.path.join(OUT, "estab_sp_ativos.csv.gz"), "wt", encoding="utf-8", newline="") as gz:
    w = csv.writer(gz, delimiter=";")
    w.writerow(COLS)
    for i in range(10):
        for r in rows(f"Estabelecimentos{i}.zip"):
            if len(r) < 30 or r[19] != "SP" or r[5] != "02":
                continue
            total += 1
            basicos.add(r[0])
            tel1 = (r[21] + r[22]).strip(); tel2 = (r[23] + r[24]).strip(); email = r[27].strip().lower()
            w.writerow([r[0] + r[1] + r[2], r[3], r[4].strip(), r[10], r[11], r[12], r[13], r[14], r[15], r[16], r[17],
                        r[18], r[20], tel1, tel2, email])
            by_cnae[r[11]] += 1
            div = r[11][:2]
            by_div[div] += 1
            by_mun[r[20]] += 1
            by_mun_div[r[20]][div] += 1
            contato["telefone"] += bool(tel1 or tel2)
            contato["email"] += bool(email)
            contato["nenhum"] += not (tel1 or tel2 or email)
            if r[10] >= "20251001":
                abertos_12m[div] += 1
        print("Estabelecimentos", i, "total SP ativos até aqui:", total, flush=True)

# 2) Porte e natureza jurídica das empresas desses estabelecimentos
porte = {}
for i in range(10):
    for r in rows(f"Empresas{i}.zip"):
        if len(r) >= 6 and r[0] in basicos:
            porte[r[0]] = (r[5], r[2])
    print("Empresas", i, flush=True)
PORTE = {"00": "Não informado", "01": "Microempresa", "03": "Empresa de pequeno porte", "05": "Demais"}
by_porte = Counter(); by_div_porte = defaultdict(Counter); mei_like = 0
with gzip.open(os.path.join(OUT, "estab_sp_ativos.csv.gz"), "rt", encoding="utf-8") as gz:
    rd = csv.reader(gz, delimiter=";"); next(rd)
    for r in rd:
        p, nat = porte.get(r[0][:8], ("", ""))
        lab = PORTE.get(p, "Sem dado")
        by_porte[lab] += 1
        by_div_porte[r[4][:2]][lab] += 1
        if nat == "2135":  # empresário individual (inclui MEI)
            mei_like += 1

res = {
    "fonte": "Receita Federal — dados abertos do CNPJ, publicação 2026-10 (arquivos de 13/10/2026)",
    "filtro": "UF = SP e situação cadastral 02 (ativa)",
    "total_estabelecimentos": total,
    "empresas_distintas": len(basicos),
    "empresario_individual_2135": mei_like,
    "contato": dict(contato),
    "porte": dict(by_porte),
    "por_divisao": {k: {"total": v, "porte": dict(by_div_porte[k]), "abertos_desde_out2025": abertos_12m[k]} for k, v in by_div.most_common()},
    "top_cnae": [{"cnae": c, "descricao": cnaes.get(c, "?"), "total": n} for c, n in by_cnae.most_common(400)],
    "por_municipio": [{"codigo": m, "nome": municipios.get(m, "?"), "total": n, "divisoes": dict(by_mun_div[m])} for m, n in by_mun.most_common()],
}
with open(os.path.join(OUT, "agregados.json"), "w", encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False)
print("FIM", total, len(basicos), flush=True)
