import { CheckCircle2, ExternalLink, Info } from "lucide-react";
import { HeroInterno } from "./pagina";
import { Foto, Logo } from "./wireframe";
import { whatsapp } from "@/content/empresa";

/**
 * Página de produto (/audita-pro e /audita-hub, briefing seção 9): a marca do produto predomina, com a cor dele e a
 * AUDITA como endosso. Para quem é, o que resolve, funcionalidades, telas, como contratar e acesso de cliente.
 * Os domínios dos produtos têm só a tela de login: esta página é a vitrine completa.
 */
export type Produto = {
  nome: "Audita PRO" | "Audita HUB";
  cor: string;
  corTexto: string;
  logo: "pro-negativa" | "hub-negativa";
  login: string;
  textoBase: string;
  paraQuem: string;
  resolve: { titulo: string; texto: string }[];
  funcionalidades: { nome: string; Icone: React.ComponentType<{ size?: number; "aria-hidden"?: boolean; style?: React.CSSProperties }> }[];
  jornadas?: { titulo: string; texto: string }[];
  contratacao: string;
  limite: string;
  telas: { codigo: string; descricao: string }[];
};

export function PaginaProduto({ p }: { p: Produto }) {
  const quero = whatsapp(`Olá! Quero conhecer o ${p.nome}.`);
  return (
    <>
      <HeroInterno
        id="produto-titulo"
        migalhas={[{ rotulo: "Plataformas", href: "/solucoes/" }, { rotulo: p.nome }]}
        kicker="Uma solução AUDITA"
        titulo={<Logo nome={p.logo} largura={440} />}
        resumo={p.textoBase}
        foto={p.telas[0]}
        traco={p.cor}
      >
        <div className="acoes">
          <a className="btn btn--bloco" style={{ background: p.cor, color: "var(--navy)" }} href={quero} target="_blank" rel="noopener">Quero conhecer</a>
          <a className="btn btn--contorno-claro btn--bloco externo" href={p.login} target="_blank" rel="noopener" aria-label={`Acessar o ${p.nome} (abre em nova aba, área exclusiva para clientes)`}>
            Acessar
          </a>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#d9e2e9" }}>&quot;Acessar&quot;: área exclusiva para clientes.</p>
      </HeroInterno>

      <section className="secao" aria-labelledby="para-quem-titulo">
        <div className="container grade grade--2">
          <div data-revelar="">
            <p className="kicker" style={{ color: p.corTexto }}>Para quem é</p>
            <h2 id="para-quem-titulo" className="t2">Pequenas e médias empresas</h2>
            <p className="medida" style={{ margin: "20px 0 0" }}>{p.paraQuem}</p>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 16 }}>
            {p.resolve.map((r) => (
              <li key={r.titulo} className="card" data-revelar="" style={{ padding: 20, borderTop: `4px solid ${p.cor}` }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{r.titulo}</p>
                <p className="mutado" style={{ margin: "6px 0 0", fontSize: 15 }}>{r.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {p.jornadas ? (
        <section className="secao secao--cinza" aria-labelledby="jornadas-titulo">
          <div className="container">
            <p className="kicker">Duas formas de usar</p>
            <h2 id="jornadas-titulo" className="t2">Do seu jeito</h2>
            <div className="grade grade--2" style={{ marginTop: 32 }}>
              {p.jornadas.map((j, i) => (
                <div key={j.titulo} className="card" data-revelar="" style={{ padding: 28 }}>
                  <span className="passo__num" style={{ background: p.cor, marginBottom: 16 }}>{i + 1}</span>
                  <h3 className="t3">{j.titulo}</h3>
                  <p style={{ margin: "10px 0 0" }}>{j.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="secao" aria-labelledby="funcionalidades-titulo">
        <div className="container">
          <p className="kicker" style={{ color: p.corTexto }}>Funcionalidades</p>
          <h2 id="funcionalidades-titulo" className="t2">O que você faz no {p.nome}</h2>
          <ul className="grade grade--3" style={{ listStyle: "none", padding: 0, margin: "32px 0 0" }}>
            {p.funcionalidades.map(({ nome, Icone }, i) => (
              <li key={nome} className="card" data-revelar="" style={{ padding: 20, display: "flex", gap: 14, alignItems: "center", transitionDelay: `${(i % 3) * 100}ms` }}>
                <Icone aria-hidden={true} size={26} style={{ color: p.corTexto, flex: "none" }} />
                <span style={{ fontWeight: 600 }}>{nome}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="secao secao--escura" aria-labelledby="telas-titulo">
        <div className="container">
          <p className="kicker">Telas</p>
          <h2 id="telas-titulo" className="t2">Conheça a plataforma</h2>
          <div className="grade grade--2" style={{ marginTop: 32 }}>
            {p.telas.map((t, i) => (
              <div key={t.codigo + i} data-revelar={i % 2 ? "direita" : "esquerda"}>
                <Foto codigo={t.codigo} descricao={t.descricao} className="foto--redonda foto--escura" style={{ height: 300 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="secao" aria-labelledby="contratar-titulo">
        <div className="container grade grade--2 grade--meio">
          <div>
            <p className="kicker" style={{ color: p.corTexto }}>Como contratar</p>
            <h2 id="contratar-titulo" className="t2">Quer o {p.nome} na sua empresa?</h2>
            <p className="medida" style={{ margin: "20px 0 0" }}>{p.contratacao}</p>
            <div className="acoes">
              <a className="btn btn--bloco" style={{ background: p.cor, color: "var(--navy)" }} href={quero} target="_blank" rel="noopener">Quero conhecer</a>
              <a className="btn btn--contorno btn--bloco" href={p.login} target="_blank" rel="noopener">
                Acessar <ExternalLink aria-hidden="true" size={18} />
              </a>
            </div>
            <p className="mutado" style={{ margin: "8px 0 0", fontSize: 13 }}>&quot;Acessar&quot; abre o login em nova aba: área exclusiva para clientes.</p>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <p className="aviso" style={{ margin: 0 }}>
              <Info aria-hidden="true" size={20} style={{ flex: "none", marginTop: 1 }} />
              <span>{p.limite}</span>
            </p>
            <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15 }}>
              <CheckCircle2 aria-hidden="true" size={20} style={{ flex: "none", color: "var(--green-text)", marginTop: 2 }} />
              Só quem contrata tem acesso. No endereço do {p.nome} existe apenas a tela de login.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
