import sys, json, urllib.request, math, unicodedata
UA = {"User-Agent": "AUDITA-PROSPECT/0.1 (planejamento interno)"}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120))
mun = json.load(open(sys.argv[1]))
geo = json.load(open(sys.argv[2]))
def ring_centroid(coords):
    # média ponderada pela área (fórmula do polígono) do maior anel
    best=None
    polys = coords if isinstance(coords[0][0][0], list) else [coords]
    for poly in polys:
        r=poly[0]; a=cx=cy=0
        for (x1,y1),(x2,y2) in zip(r, r[1:]+r[:1]):
            f=x1*y2-x2*y1; a+=f; cx+=(x1+x2)*f; cy+=(y1+y2)*f
        a/=2
        if a and (best is None or abs(a)>abs(best[0])): best=(a, cx/(6*a), cy/(6*a))
    return best[2], best[1]
cent={}
for f in geo["features"]:
    lat,lon = ring_centroid(f["geometry"]["coordinates"])
    cent[f["properties"]["codarea"]] = (lat,lon)
norm=lambda s: unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode().upper().replace("-"," ").replace("'"," ").strip()
out=[]
for m in mun:
    c=str(m["id"]); lat,lon=cent.get(c,(None,None))
    out.append({"ibge":c,"nome":m["nome"],"chave":norm(m["nome"]),"lat":lat,"lon":lon,
                "microrregiao":m["microrregiao"]["nome"],"regiao_imediata":m["regiao-imediata"]["nome"],"regiao_intermediaria":m["regiao-imediata"]["regiao-intermediaria"]["nome"]})
so=[o for o in out if o["chave"]=="SOROCABA"][0]
def km(a,b):
    R=6371; p1,p2=math.radians(a["lat"]),math.radians(b["lat"]); dp=p2-p1; dl=math.radians(b["lon"]-a["lon"])
    return 2*R*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
for o in out: o["km_sorocaba"]=round(km(so,o),1) if o["lat"] else None
json.dump(out, open(sys.argv[3],"w"), ensure_ascii=False)

print(len(out), "municípios;", sum(1 for o in out if o["lat"]), "com centro;", so["lat"], so["lon"])
print(sorted([(o["km_sorocaba"],o["nome"]) for o in out])[:12])
