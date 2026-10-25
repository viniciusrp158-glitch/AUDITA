import Link from "next/link";
import { CheckCircle2, ExternalLink, Info, UserRound } from "lucide-react";
import { HeroInterno } from "./pagina";
import { Logo } from "./wireframe";
import { whatsapp } from "@/content/empresa";
import type { Imagem, Plataforma } from "@/content/plataformas";

/**
 * Página de produto (/audita-pro e /audita-hub, briefing seção 9): a marca do produto predomina, com a cor dele e a
 * AUDITA como endosso. O conteúdo vem de content/plataformas.ts (material dos sistemas enviado pelo Diretor).
 * Os domínios dos produtos têm só a tela de login: esta página é a vitrine completa.
 */
export type Produto = {
  nome: "Audita PRO" | "Audita HUB";
  cor: string;
  corTexto: string;
  logo: "pro-negativa" | "hub-negativa";
  login: string;
  textoBase: string;
  chamada: { rotulo: string; mensagem: string };
  contratacao: string;
  limites: string[];
  dados: Plataforma;
};

export function PaginaProduto({ p }: { p: Produto }) {
  const d = p.dados;
  const chamada = whatsapp(p.chamada.mensagem);
  const outro = p.nome === "Audita PRO" ? { nome: "Audita HUB", href: "/audita-hub/" } : { nome: "Audita PRO", href: "/audita-pro/" };
  return (
    <>
      <HeroInterno
        id="produto-titulo"
        migalhas={[{ rotulo: "Plataformas", href: "/solucoes/" }, { rotulo: p.nome }]}
        kicker="Uma solução AUDITA"
        titulo={<Logo nome={p.logo} largura={440} />}
        resumo={p.textoBase}
        foto={{ codigo: p.nome, descricao: "tela do sistema ao fundo", src: d.telas[0].src }}
        traco={p.cor}
      >
        <div className="acoes">
          <a className="btn btn--bloco" style={{ background: p.cor, color: "var(--navy)" }} href={chamada} target="_blank" rel="noopener">{p.chamada.rotulo}</a>
          <a className="btn btn--contorno-claro btn--bloco externo" href={p.login} target="_blank" rel="noopener" aria-label={`Acessar o ${p.nome} (abre em nova aba, área exclusiva para clientes)`}>
            Acessar
          </a>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#d9e2e9" }}>&quot;Acessar&quot;: área exclusiva para clientes.</p>
      </HeroInterno>

      {/* O que é */}
      <section className="secao" aria-labelledby="o-que-e-titulo">
        <div className="container grade grade--2 grade--meio">
          <div data-revelar="">
            <p className="kicker" style={{ color: p.corTexto }}>O que é</p>
            <h2 id="o-que-e-titulo" className="t2">{p.nome}</h2>
            {d.oQueE.map((t) => <p key={t.slice(0, 20)} className="medida" style={{ margin: "16px 0 0" }}>{t}</p>)}
          </div>
          <div data-revelar="direita">
            <Tela img={d.destaque} redonda />
          </div>
        </div>
      </section>

      {/* Para quem */}
      <section className="secao secao--cinza" aria-labelledby="para-quem-titulo">
        <div className="container">
          <p className="kicker" style={{ color: p.corTexto }}>Para quem</p>
          <h2 id="para-quem-titulo" className="t2">Cada perfil vê o que precisa</h2>
          <ul className={d.perfis.length > 4 ? "grade grade--5" : "grade grade--4"} style={{ listStyle: "none", padding: 0, margin: "32px 0 0" }}>
            {d.perfis.map((perfil, i) => (
              <li key={perfil.nome} className="card" data-revelar="" style={{ padding: 20, borderTop: `4px solid ${p.cor}`, transitionDelay: `${i * 80}ms` }}>
                <UserRound aria-hidden="true" size={24} style={{ color: p.corTexto }} />
                <p style={{ margin: "10px 0 0", fontWeight: 700 }}>{perfil.nome}</p>
                <p className="mutado" style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>{perfil.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRO: como a auditoria acontece / HUB: formas de uso */}
      {d.passos ? (
        <section className="secao" aria-labelledby="passos-titulo">
          <div className="container">
            <p className="kicker" style={{ color: p.corTexto }}>Do planejamento ao relatório</p>
            <h2 id="passos-titulo" className="t2">Como uma auditoria acontece no {p.nome}</h2>
            <ol className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "40px 0 0", rowGap: 32 }}>
              {d.passos.map((passo, i) => (
                <li key={passo.nome} className="passo" data-revelar="" style={{ transitionDelay: `${(i % 4) * 150}ms` }}>
                  <span className="passo__num">{i + 1}</span>
                  <p style={{ margin: "14px 0 0", fontWeight: 700 }}>{passo.nome}</p>
                  <p className="mutado" style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>{passo.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
      {d.jornadas ? (
        <section className="secao" aria-labelledby="jornadas-titulo">
          <div className="container">
            <p className="kicker" style={{ color: p.corTexto }}>Duas formas de usar</p>
            <h2 id="jornadas-titulo" className="t2">Do seu jeito</h2>
            <div className="grade grade--2" style={{ marginTop: 32 }}>
              {d.jornadas.map((j, i) => (
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

      {/* Módulos */}
      <section className="secao secao--cinza" aria-labelledby="modulos-titulo">
        <div className="container">
          <p className="kicker" style={{ color: p.corTexto }}>Funcionalidades</p>
          <h2 id="modulos-titulo" className="t2">O que você faz no {p.nome}</h2>
          <div className="grade grade--3" style={{ marginTop: 32 }}>
            {d.modulos.map((m, i) => (
              <article key={m.nome} className="card" data-revelar="" style={{ padding: 24, transitionDelay: `${(i % 3) * 100}ms` }}>
                <h3 className="t3" style={{ fontSize: 20 }}>{m.nome}</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8, fontSize: 15, lineHeight: 1.5 }}>
                  {m.itens.map((item) => (
                    <li key={item} style={{ display: "flex", gap: 8 }}>
                      <CheckCircle2 aria-hidden="true" size={18} style={{ flex: "none", color: p.corTexto, marginTop: 3 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Telas reais */}
      <section className="secao secao--escura" aria-labelledby="telas-titulo">
        <div className="container">
          <p className="kicker">Telas</p>
          <h2 id="telas-titulo" className="t2">Conheça a plataforma</h2>
          <p style={{ margin: "12px 0 0", color: "#d9e2e9" }}>Capturas reais do sistema, com dados fictícios de demonstração.</p>
          <div className="grade grade--2" style={{ marginTop: 32 }}>
            {d.telas.map((t, i) => (
              <div key={t.src} data-revelar={i % 2 ? "direita" : "esquerda"}>
                <Tela img={t} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", marginTop: 40 }}>
            {d.celulares.map((c) => (
              <figure key={c.src} style={{ margin: 0, width: 200, textAlign: "center" }} data-revelar="">
                <a href={c.src} target="_blank" rel="noopener" style={{ display: "block", borderRadius: 24, overflow: "hidden", border: "6px solid #021428", background: "#021428" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- site estático, imagem já em WebP */}
                  <img src={c.src} alt={c.alt} width={c.largura} height={c.altura} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
                </a>
                <figcaption style={{ marginTop: 8, fontSize: 14, color: "#d9e2e9" }}>{c.legenda}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="secao" aria-labelledby="diferenciais-titulo">
        <div className="container">
          <p className="kicker" style={{ color: p.corTexto }}>Diferenciais</p>
          <h2 id="diferenciais-titulo" className="t2">Por que o {p.nome}</h2>
          <ul className="grade grade--3" style={{ listStyle: "none", padding: 0, margin: "32px 0 0" }}>
            {d.diferenciais.map((df, i) => (
              <li key={df.titulo} data-revelar="" style={{ borderLeft: "0", paddingTop: 16, borderTop: `3px solid ${p.cor}`, transitionDelay: `${(i % 3) * 100}ms` }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 17 }}>{df.titulo}</p>
                <p className="mutado" style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>{df.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Como contratar e limites */}
      <section className="secao secao--cinza" aria-labelledby="contratar-titulo">
        <div className="container grade grade--2">
          <div>
            <p className="kicker" style={{ color: p.corTexto }}>Como contratar</p>
            <h2 id="contratar-titulo" className="t2">Quer o {p.nome} na sua empresa?</h2>
            <p className="medida" style={{ margin: "20px 0 0" }}>{p.contratacao}</p>
            <div className="acoes">
              <a className="btn btn--bloco" style={{ background: p.cor, color: "var(--navy)" }} href={chamada} target="_blank" rel="noopener">{p.chamada.rotulo}</a>
              <a className="btn btn--contorno btn--bloco" href={p.login} target="_blank" rel="noopener">
                Acessar <ExternalLink aria-hidden="true" size={18} />
              </a>
            </div>
            <p className="mutado" style={{ margin: "8px 0 0", fontSize: 13 }}>&quot;Acessar&quot; abre o login em nova aba: área exclusiva para clientes.</p>
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            {p.limites.map((l) => (
              <p key={l.slice(0, 24)} className="aviso" style={{ margin: 0, background: "var(--white)" }}>
                <Info aria-hidden="true" size={20} style={{ flex: "none", marginTop: 1 }} />
                <span>{l}</span>
              </p>
            ))}
            <p style={{ margin: 0, fontSize: 15 }}>
              O Audita PRO mostra onde a empresa está em relação às normas; o Audita HUB mantém a rotina em dia entre uma auditoria e outra.{" "}
              <Link href={outro.href} style={{ fontWeight: 600, color: "var(--green-text)" }}>Conheça o {outro.nome}</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function Tela({ img, redonda = false }: { img: Imagem; redonda?: boolean }) {
  return (
    <figure style={{ margin: 0 }}>
      <a href={img.src} target="_blank" rel="noopener" style={{ display: "block", borderRadius: redonda ? 20 : 12, overflow: "hidden", boxShadow: "var(--shadow-card)", background: "#e8eef2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- site estático, imagem já em WebP */}
        <img src={img.src} alt={img.alt} width={img.largura} height={img.altura} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
      </a>
      <figcaption className="mutado" style={{ marginTop: 8, fontSize: 13, color: redonda ? undefined : "#d9e2e9" }}>{img.legenda}</figcaption>
    </figure>
  );
}
