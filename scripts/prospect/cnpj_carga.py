"""AUDITA PROSPECT — prepara a carga da base pública de CNPJ para as tabelas audita.ibge_municipalities e
audita.cnpj_establishments (migração 20261114120000_p1_prospect). Não acessa o banco: só gera os arquivos.

Entrada (pasta da publicação, ex.: /home/deploy/audita/cnpj/2026-10):
  sp/estab_sp_ativos.csv.gz      (de cnpj_sp.py)        Empresas*.zip, Municipios.zip
  sp/municipios_ibge_sp.json     (de ibge_municipios.py)
Saída em sp/:
  carga_municipios.csv           ibge_code, name, uf, rfb_code, lat, lon, km_from_base, immediate_region
  carga_estabelecimentos.csv.gz  colunas de audita.cnpj_establishments (empresas-alvo: natureza ≠ 2135, porte 01/03/05)
  carga_resumo.json              contagens e descartes por motivo
Uso: python3 cnpj_carga.py <pasta> <AAAA-MM>
"""
import csv, gzip, io, json, os, re, sys, unicodedata, zipfile
from collections import Counter

D, REF = sys.argv[1], sys.argv[2]
SP = os.path.join(D, "sp")
csv.field_size_limit(10_000_000)
norm = lambda s: unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper().replace("-", " ").replace("'", " ").strip()
ALIAS = {"EMBU": "EMBU DAS ARTES", "MOJI MIRIM": "MOGI MIRIM", "SAO LUIS DO PARAITINGA": "SAO LUIZ DO PARAITINGA", "FLORINIA": "FLORINEA"}


def rows(name):
    z = zipfile.ZipFile(os.path.join(D, name))
    with z.open(z.namelist()[0]) as fh:
        yield from csv.reader(io.TextIOWrapper(fh, encoding="latin-1", newline=""), delimiter=";")


# Passo A: CNPJ básico das empresas com estabelecimento ativo em SP (mapa de bits de 10^8 posições, ~12 MB)
# e códigos de município da Receita que aparecem em SP (há nomes repetidos em outros estados)
bits = bytearray(12_500_000)
sp_mun_codes = set()
with gzip.open(os.path.join(SP, "estab_sp_ativos.csv.gz"), "rt", encoding="utf-8") as gz:
    rd = csv.reader(gz, delimiter=";"); next(rd)
    for r in rd:
        b = r[0][:8]
        sp_mun_codes.add(r[12])
        if b.isdigit():
            n = int(b); bits[n >> 3] |= 1 << (n & 7)
print("passo A concluído; códigos de município em SP:", len(sp_mun_codes), flush=True)

# Municípios: IBGE + código da Receita (só códigos observados em SP)
ibge = {m["chave"]: m for m in json.load(open(os.path.join(SP, "municipios_ibge_sp.json"), encoding="utf-8"))}
rfb_to_ibge = {}
for r in rows("Municipios.zip"):
    if r[0] not in sp_mun_codes:
        continue
    k = norm(r[1]); k = ALIAS.get(k, k)
    if k in ibge:
        rfb_to_ibge[r[0]] = ibge[k]["ibge"]
        ibge[k]["rfb"] = r[0]
with open(os.path.join(SP, "carga_municipios.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["ibge_code", "name", "uf", "rfb_code", "lat", "lon", "km_from_base", "immediate_region"])
    for m in sorted(ibge.values(), key=lambda x: x["ibge"]):
        w.writerow([m["ibge"], m["nome"], "SP", m.get("rfb", ""), f'{m["lat"]:.6f}', f'{m["lon"]:.6f}', f'{m["km_sorocaba"]:.1f}', m["regiao_imediata"]])
print("municípios:", len(ibge), "com código da Receita:", len(rfb_to_ibge), "sem casamento:", sorted(sp_mun_codes - set(rfb_to_ibge))[:10], flush=True)

# Passo B: razão social, natureza e porte das empresas-alvo
emp = {}
for i in range(10):
    for r in rows(f"Empresas{i}.zip"):
        if len(r) < 6 or not r[0].isdigit():
            continue
        n = int(r[0])
        if bits[n >> 3] & (1 << (n & 7)) and r[2] != "2135" and r[5] in ("01", "03", "05"):
            emp[n] = (r[1].strip(), r[2], r[5])
    print("Empresas", i, len(emp), flush=True)
del bits

# Passo C: estabelecimentos no formato da tabela
digits = lambda s: re.sub(r"\D", "", s or "")
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
desc = Counter(); total = 0
COLS = ["cnpj", "is_headquarters", "legal_name", "trade_name", "legal_nature", "size_code", "started_on", "cnae_main",
        "cnae_secondary", "street", "number", "complement", "district", "zip", "ibge_code", "phone1", "phone2", "email", "publication"]
with gzip.open(os.path.join(SP, "estab_sp_ativos.csv.gz"), "rt", encoding="utf-8") as gz, \
     gzip.open(os.path.join(SP, "carga_estabelecimentos.csv.gz"), "wt", encoding="utf-8", newline="") as out:
    rd = csv.reader(gz, delimiter=";"); next(rd)
    w = csv.writer(out, lineterminator="\n"); w.writerow(COLS)
    for r in rd:
        cnpj, matriz, fantasia, inicio, cnae, cnae_sec, tipo_log, logr, num, compl, bairro, cep, mun, tel1, tel2, email = r
        b = cnpj[:8]
        info = emp.get(int(b)) if b.isdigit() else None
        if not info:
            desc["mei_ou_porte"] += 1; continue
        ibge_code = rfb_to_ibge.get(mun)
        if not ibge_code:
            desc["municipio"] += 1; continue
        if not re.fullmatch(r"\d{7}", cnae or ""):
            desc["cnae"] += 1; continue
        started = f"{inicio[:4]}-{inicio[4:6]}-{inicio[6:8]}" if re.fullmatch(r"(19|20)\d{6}", inicio or "") else ""
        p1, p2 = digits(tel1), digits(tel2)
        p1 = p1 if 10 <= len(p1) <= 11 else ""; p2 = p2 if 10 <= len(p2) <= 11 and p2 != p1 else ""
        mail = email.strip().lower()
        mail = mail if EMAIL.match(mail) and len(mail) <= 254 else ""
        z = digits(cep); z = z if len(z) == 8 else ""
        sec = "{" + ",".join(c for c in cnae_sec.split(",") if re.fullmatch(r"\d{7}", c.strip())) + "}"
        street = " ".join(x for x in (tipo_log.strip(), logr.strip()) if x)
        w.writerow([cnpj, "true" if matriz == "1" else "false", info[0], fantasia or "", info[1], info[2], started, cnae, sec,
                    street, num.strip(), compl.strip()[:120], bairro.strip(), z, ibge_code, p1, p2, mail, REF])
        total += 1
res = {"publicacao": REF, "linhas": total, "descartes": dict(desc)}
json.dump(res, open(os.path.join(SP, "carga_resumo.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("FIM", res, flush=True)
