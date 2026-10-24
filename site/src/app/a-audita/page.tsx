import type { Metadata } from "next";
import { CheckCircle2, Leaf, ShieldCheck, Users } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato, HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { Foto } from "@/components/wireframe";
import { DIFERENCIAIS, MISSAO, NECESSIDADES, PASSOS, PROPOSITO, PUBLICO, QUEM_SOMOS, VALORES, VISAO } from "@/content/institucional";

export const metadata: Metadata = {
  title: "A AUDITA",
  description: "Quem somos, propósito, missão, visão, valores e como a AUDITA trabalha com pequenas e médias empresas.",
};

/** /a-audita: quem somos, propósito, missão, visão, valores, por que a AUDITA e como trabalhamos (briefing, seção 8). */
export default function AAudita() {
  return (
    <>
      <Cabecalho ativo="A AUDITA" />
      <main>
        <HeroInterno
          id="a-audita-titulo"
          migalhas={[{ rotulo: "A AUDITA" }]}
          kicker="A AUDITA"
          titulo={<>Conheça a <span className="marca-texto">AUDITA</span></>}
          resumo="Soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão para pequenas e médias empresas."
          foto={{ codigo: "IMG-20", descricao: "ambiente de trabalho organizado e seguro, sem rostos identificáveis da equipe" }}
        />

        <section id="quem-somos" className="secao" aria-labelledby="quem-somos-titulo">
          <div className="container grade grade--2 grade--meio">
            <div data-revelar="">
              <p className="kicker">Quem somos</p>
              <h2 id="quem-somos-titulo" className="t2">Conhecimento técnico, gestão preventiva e tecnologia</h2>
              <p className="medida" style={{ margin: "20px 0 0" }}>{QUEM_SOMOS}</p>
              <p className="medida" style={{ margin: "16px 0 0" }}>{PUBLICO}</p>
            </div>
            <div className="foto--redonda" data-revelar="direita">
              <Foto codigo="IMG-02" descricao="profissional com EPI conversando com gestor em ambiente de trabalho real" style={{ height: 380 }} />
            </div>
          </div>
        </section>

        <section className="secao secao--escura" aria-labelledby="proposito-titulo">
          <div className="container" style={{ maxWidth: 960 }}>
            <p className="kicker">Propósito</p>
            <h2 id="proposito-titulo" className="t2" style={{ fontSize: "clamp(24px, 3.4vw, 34px)", lineHeight: 1.3 }} data-revelar="">
              {PROPOSITO}
            </h2>
          </div>
        </section>

        <section id="missao-visao-valores" className="secao secao--cinza" aria-labelledby="mvv-titulo">
          <div className="container">
            <p className="kicker">Identidade</p>
            <h2 id="mvv-titulo" className="t2">Missão, visão e valores</h2>
            <div className="grade grade--2" style={{ marginTop: 40 }}>
              {[
                { rotulo: "Missão", texto: MISSAO, Icone: ShieldCheck },
                { rotulo: "Visão", texto: VISAO, Icone: Users },
              ].map(({ rotulo, texto, Icone }) => (
                <div key={rotulo} className="card com-losango" data-revelar="" style={{ padding: 28, display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <span className="losango" aria-hidden="true"><Icone /></span>
                  <div>
                    <h3 className="t3"><span className="marca-texto">{rotulo}</span></h3>
                    <p style={{ margin: "12px 0 0" }}>{texto}</p>
                  </div>
                </div>
              ))}
            </div>
            <h3 className="t3" style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 12 }}>
              <Leaf aria-hidden="true" style={{ color: "var(--green-text)" }} /> Valores
            </h3>
            <ul className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "24px 0 0" }}>
              {VALORES.map(({ nome, texto, Icone }, i) => (
                <li key={nome} className="card com-losango" data-revelar="" style={{ padding: 24, transitionDelay: `${(i % 4) * 100}ms` }}>
                  <span className="losango" aria-hidden="true" style={{ width: 44, height: 44, margin: "6px 6px 18px" }}><Icone /></span>
                  <p style={{ margin: 0, fontWeight: 700 }}>{nome}</p>
                  <p className="mutado" style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="por-que-a-audita" className="secao" aria-labelledby="por-que-titulo">
          <div className="container">
            <p className="kicker">Diferenciais</p>
            <h2 id="por-que-titulo" className="t2">Por que a AUDITA</h2>
            <ul className="grade grade--5" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {DIFERENCIAIS.map(({ titulo, texto, Icone }, i) => (
                <li key={titulo} className="com-losango" data-revelar="" style={{ transitionDelay: `${i * 100}ms` }}>
                  <span className="losango" aria-hidden="true" style={{ margin: "10px 10px 22px" }}><Icone /></span>
                  <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.35 }}>{titulo}</p>
                  <p className="mutado" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="secao secao--cinza" aria-labelledby="resolvemos-titulo">
          <div className="container grade grade--2">
            <div data-revelar="">
              <p className="kicker">O que resolvemos</p>
              <h2 id="resolvemos-titulo" className="t2">
                A AUDITA atende empresas de <span className="marca-texto">todos os segmentos</span>.
              </h2>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {NECESSIDADES.map((n) => (
                <li key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--white)", borderRadius: 12, padding: "14px 18px" }}>
                  <CheckCircle2 aria-hidden="true" size={22} style={{ flex: "none", color: "var(--green-text)", marginTop: 1 }} />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="como-trabalhamos" className="secao" aria-labelledby="como-titulo">
          <div className="container">
            <p className="kicker">Método</p>
            <h2 id="como-titulo" className="t2">Como trabalhamos</h2>
            <ol className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {PASSOS.map((passo, i) => (
                <li key={passo} className="passo" data-revelar="" style={{ display: "flex", alignItems: "center", gap: 16, transitionDelay: `${i * 250}ms` }}>
                  <span className="passo__num">{i + 1}</span>
                  <span className="t3" style={{ fontSize: 19 }}>{passo}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <ChamadaContato />
      </main>
      <Rodape />
    </>
  );
}
