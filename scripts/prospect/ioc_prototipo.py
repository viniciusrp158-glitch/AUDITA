import json, math
a=json.load(open("/home/deploy/audita/cnpj/2026-10/sp/nichos.json"))
ag=json.load(open("/home/deploy/audita/cnpj/2026-10/sp/agregados.json"))
tot={m["nome"]:m["total"] for m in ag["por_municipio"]}
import unicodedata
norm=lambda s: unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode().upper().replace("-"," ").replace("'"," ").strip()
G={"Construção civil":["construcao"],"Indústria":["metal","maquinas","quimica","alimentos","madeira","minerais","textil"],"Atacado, armazenagem e transporte":["atacado","armazenagem","transporte"]}
rows=[]
for m in a["municipios"]:
    if m["km"] is None or m["km"]>150: continue
    g={k:sum(m["alvo_por_nicho"].get(n,0) for n in v) for k,v in G.items()}
    alvo=sum(g.values()); t=tot.get(norm(m["nome"]),0)
    if alvo<30: continue
    rows.append(dict(nome=m["nome"],km=m["km"],alvo=alvo,grupos=g,total=t,share=alvo/t if t else 0))
mx=max(r["alvo"] for r in rows); ms=max(r["share"] for r in rows)
for r in rows:
    Q=math.log(r["alvo"])/math.log(mx); C=r["share"]/ms; D=max(0,1-r["km"]/150)
    r["Q"],r["C"],r["D"]=round(30*Q,1),round(20*C,1),round(10*D,1)
    r["ioc"]=round((30*Q+20*C+10*D)/60*100)
rows.sort(key=lambda r:-r["ioc"])
print(len(rows),"municípios ≤150 km com 30+ empresas-alvo")
for r in rows[:25]: print(r["ioc"], r["nome"], r["km"], r["alvo"], r["grupos"], round(r["share"]*100,2), r["Q"], r["C"], r["D"])
near=[r for r in rows if r["km"]<=60]
print("--- até 60 km"); 
for r in near[:15]: print(r["ioc"], r["nome"], r["km"], r["alvo"], r["grupos"], round(r["share"]*100,2))
f50={k:sum(a["nichos"][n]["faixas"].get("ate_50km",0) for n in v) for k,v in G.items()}
f100={k:sum(a["nichos"][n]["faixas"].get("ate_100km",0) for n in v) for k,v in G.items()}
fsp={k:sum(a["nichos"][n]["alvo"] for n in v) for k,v in G.items()}
c12={k:sum(a["nichos"][n]["alvo_abertos_12m"] for n in v) for k,v in G.items()}
print("50km",f50,"100km",f100,"SP",fsp,"12m",c12)
json.dump(rows[:40], open("/home/deploy/audita/cnpj/2026-10/sp/ioc_prototipo.json","w"), ensure_ascii=False)
