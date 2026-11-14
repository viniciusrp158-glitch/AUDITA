"""AUDITA PROSPECT — Fase 0: contagens por nicho (CNAE) no recorte de SP, para propor os nichos de entrada e as regiões.
Entrada: <pasta>/sp/estab_sp_ativos.csv.gz, <pasta>/Empresas*.zip, <pasta>/Municipios.zip, <pasta>/sp/municipios_ibge_sp.json
Saída: <pasta>/sp/nichos.json
Critério "empresa-alvo": estabelecimento ativo, natureza jurídica diferente de empresário individual (2135, que inclui o MEI)
e porte microempresa (01) ou pequeno porte (03) ou demais (05).
"""
import csv, gzip, io, json, os, sys, unicodedata, zipfile
from collections import Counter, defaultdict

D = sys.argv[1]
SP = os.path.join(D, "sp")
csv.field_size_limit(10_000_000)

NICHOS = {
    "construcao": ("Construção civil", ("41", "42", "43")),
    "alimentos": ("Indústria de alimentos e bebidas", ("10", "11")),
    "metal": ("Metalurgia e produtos de metal", ("24", "25")),
    "maquinas": ("Máquinas, equipamentos e veículos", ("28", "29", "30")),
    "quimica": ("Química, plásticos e borracha", ("20", "21", "22")),
    "madeira": ("Madeira, móveis, papel e gráfica", ("16", "17", "18", "31")),
    "textil": ("Têxtil, confecção e calçados", ("13", "14", "15")),
    "minerais": ("Minerais não metálicos (cerâmica, concreto, vidro)", ("23",)),
    "transporte": ("Transporte rodoviário de cargas", ("4930",)),
    "armazenagem": ("Armazenagem e logística", ("52",)),
    "atacado": ("Comércio atacadista", ("46",)),
    "saude": ("Saúde (hospitais e clínicas)", ("86",)),
    "oficinas": ("Manutenção e reparação de veículos", ("4520",)),
    "facilities": ("Limpeza, conservação e facilities", ("81",)),
    "combustiveis": ("Postos de combustíveis", ("4731",)),
    "residuos": ("Coleta e tratamento de resíduos", ("38", "39")),
    "agro": ("Agropecuária", ("01", "02")),
    "restaurantes": ("Restaurantes e alimentação", ("56",)),
}


def nicho_de(cnae):
    for k, (_, pref) in NICHOS.items():
        if any(cnae.startswith(p) for p in pref):
            return k
    return None


def rows(name):
    z = zipfile.ZipFile(os.path.join(D, name))
    with z.open(z.namelist()[0]) as fh:
        yield from csv.reader(io.TextIOWrapper(fh, encoding="latin-1", newline=""), delimiter=";")


norm = lambda s: unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper().replace("-", " ").replace("'", " ").strip()
ibge = {m["chave"]: m for m in json.load(open(os.path.join(SP, "municipios_ibge_sp.json"), encoding="utf-8"))}
# Receita usa código próprio de município (SIAFI); casamento pelo nome normalizado
ALIAS = {"EMBU": "EMBU DAS ARTES", "MOJI MIRIM": "MOGI MIRIM", "SANTA BARBARA D OESTE": "SANTA BARBARA D OESTE",
         "BIRITIBA MIRIM": "BIRITIBA MIRIM", "SAO LUIS DO PARAITINGA": "SAO LUIZ DO PARAITINGA", "FLORINIA": "FLORINEA"}
siafi = {}
semcasar = []
for r in rows("Municipios.zip"):
    k = norm(r[1]); k = ALIAS.get(k, k)
    if k in ibge:
        siafi[r[0]] = ibge[k]
used = set()

# Estabelecimentos do recorte, só os de algum nicho
estab = []
basicos = set()
with gzip.open(os.path.join(SP, "estab_sp_ativos.csv.gz"), "rt", encoding="utf-8") as gz:
    rd = csv.reader(gz, delimiter=";"); next(rd)
    for r in rd:
        n = nicho_de(r[4])
        if not n:
            continue
        estab.append((r[0][:8], n, r[12], bool(r[13] or r[14]), bool(r[15]), r[3]))
        basicos.add(r[0][:8])
print("estabelecimentos em nichos:", len(estab), flush=True)

emp = {}
for i in range(10):
    for r in rows(f"Empresas{i}.zip"):
        if len(r) >= 6 and r[0] in basicos:
            emp[r[0]] = (r[2], r[5])
    print("Empresas", i, flush=True)

BANDS = [("ate_50km", 50), ("ate_100km", 100), ("ate_150km", 150), ("estado", 10_000)]
res = {k: {"nome": v[0], "cnae": list(v[1]), "total": 0, "alvo": 0, "alvo_contato": 0, "alvo_email": 0,
           "alvo_abertos_12m": 0, "porte": Counter(), "faixas": Counter(), "municipios": Counter()} for k, v in NICHOS.items()}
mun_total = Counter(); mun_alvo = defaultdict(Counter); faltou_mun = Counter()
for b, n, mun, tel, mail, inicio in estab:
    nat, porte = emp.get(b, ("", ""))
    x = res[n]
    x["total"] += 1
    m = siafi.get(mun)
    if not m:
        faltou_mun[mun] += 1
    if nat == "2135" or porte not in ("01", "03", "05"):
        continue
    x["alvo"] += 1
    x["alvo_contato"] += tel or mail
    x["alvo_email"] += mail
    x["alvo_abertos_12m"] += inicio >= "20251001"
    x["porte"][{"01": "ME", "03": "EPP", "05": "Demais"}[porte]] += 1
    if m:
        for lab, lim in BANDS:
            if m["km_sorocaba"] <= lim:
                x["faixas"][lab] += 1
        x["municipios"][m["ibge"]] += 1
        mun_alvo[m["ibge"]][n] += 1

out = {
    "fonte": "Receita Federal — dados abertos do CNPJ, publicação 2026-10; IBGE — municípios e malha de SP",
    "criterio_alvo": "ativo, natureza ≠ 2135 (empresário individual/MEI), porte ME, EPP ou demais",
    "municipios_sem_casamento": dict(faltou_mun.most_common(20)),
    "nichos": {k: {**{kk: (dict(vv) if isinstance(vv, Counter) else vv) for kk, vv in v.items() if kk != "municipios"},
                   "top_municipios": [{"ibge": c, "nome": next(m["nome"] for m in ibge.values() if m["ibge"] == c), "alvo": q,
                                       "km": next(m["km_sorocaba"] for m in ibge.values() if m["ibge"] == c)} for c, q in v["municipios"].most_common(25)]}
               for k, v in res.items()},
    "municipios": [{"ibge": m["ibge"], "nome": m["nome"], "km": m["km_sorocaba"], "regiao_imediata": m["regiao_imediata"],
                    "alvo_por_nicho": dict(mun_alvo.get(m["ibge"], {}))} for m in ibge.values()],
}
json.dump(out, open(os.path.join(SP, "nichos.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("FIM; municípios da Receita sem casamento:", sum(faltou_mun.values()), list(faltou_mun)[:5], flush=True)
