import type { Metadata } from "next";
import Link from "next/link";
import { HardHat, Leaf, Info, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato, HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { Logo } from "@/components/wireframe";
import { FORMATOS } from "@/content/institucional";
import { FAMILIAS, servicosPublicados, type Familia } from "@/content/servicos";

export const metadata: Metadata = {
  title: "Soluções",
  description: "Os três pilares (SST, Meio Ambiente e SGI) e as cinco famílias de serviço da AUDITA para pequenas e médias empresas.",
};

const PILARES: { nome: Familia["pilar"]; Icone: typeof HardHat }[] = [
  { nome: "Segurança e Saúde do Trabalho", Icone: HardHat },
  { nome: "Meio Ambiente", Icone: Leaf },
  { nome: "Sistemas de Gestão (SGI)", Icone: ClipboardCheck },
];

/** /solucoes: os três pilares e as cinco famílias de serviço (briefing, seções 7 e 8), sem preços. */
export default function Solucoes() {
  return (
    <>
      <Cabecalho ativo="Soluções" />
      <main>
        <HeroInterno
          id="solucoes-titulo"
          migalhas={[{ rotulo: "Soluções" }]}
          kicker="Soluções"
          titulo={<>Nossas <span className="marca-texto">soluções</span></>}
          resumo="Soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão para pequenas e médias empresas."
          foto={{ codigo: "IMG-21", descricao: "trabalhador com EPI completo em inspeção" }}
        />

        {PILARES.map(({ nome, Icone }, i) => {
          const familias = FAMILIAS.filter((f) => f.pilar === nome);
          return (
            <section key={nome} className={i % 2 ? "secao secao--cinza" : "secao"} aria-labelledby={`pilar-${i}`}>
              <div className="container">
                <div className="com-losango" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="losango" aria-hidden="true"><Icone /></span>
                  <h2 id={`pilar-${i}`} className="t2">{nome}</h2>
                </div>
                <div className="grade grade--3" style={{ marginTop: 32 }}>
                  {familias.map((f) => (
                    <article key={f.slug} className="card" data-revelar="">
                      <div className="card__corpo" style={{ height: "100%", boxSizing: "border-box" }}>
                        <h3 className="t3">{f.nome}</h3>
                        <p className="mutado" style={{ margin: 0, fontSize: 15 }}>{f.resumo}</p>
                        <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "grid", gap: 6, fontSize: 15, flex: 1 }}>
                          {servicosPublicados(f).map((s) => (
                            <li key={s.codigo} style={{ display: "flex", gap: 8 }}>
                              <CheckCircle2 aria-hidden="true" size={18} style={{ flex: "none", color: "var(--green-text)", marginTop: 3 }} />
                              {s.nome}
                            </li>
                          ))}
                        </ul>
                        <Link href={`/solucoes/${f.slug}/`} className="btn btn--contorno" style={{ alignSelf: "flex-start" }}>
                          Ver serviços e limites
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
                {nome === "Sistemas de Gestão (SGI)" ? (
                  <p className="aviso" style={{ margin: "24px 0 0" }}>
                    <Info aria-hidden="true" size={20} style={{ flex: "none", marginTop: 1 }} />
                    <span>Nenhuma oferta representa certificação acreditada. Auditoria interna e diagnóstico não são certificação.</span>
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}

        <section className="secao secao--escura" aria-labelledby="plataformas-titulo">
          <div className="container">
            <p className="kicker">Tecnologia própria</p>
            <h2 id="plataformas-titulo" className="t2">Plataformas que acompanham os serviços</h2>
            <div className="grade grade--2" style={{ marginTop: 40 }}>
              <Link href="/audita-pro/" className="vidro" style={{ textDecoration: "none", padding: 24 }} data-revelar="">
                <Logo nome="pro-negativa" />
                <span style={{ marginTop: 8 }}>Auditorias e documentos de SSMA e SGI, acompanhados em tempo real.</span>
                <span style={{ fontWeight: 600, color: "var(--green)" }}>Conhecer o Audita PRO</span>
              </Link>
              <Link href="/audita-hub/" className="vidro" style={{ textDecoration: "none", padding: 24 }} data-revelar="">
                <Logo nome="hub-negativa" />
                <span style={{ marginTop: 8 }}>A rotina de SSMA da sua empresa em um só lugar.</span>
                <span style={{ fontWeight: 600, color: "var(--green)" }}>Conhecer o Audita HUB</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="secao" aria-labelledby="formatos-titulo">
          <div className="container grade grade--2">
            <div>
              <p className="kicker">Como contratar</p>
              <h2 id="formatos-titulo" className="t2">Formatos de contratação</h2>
              <p className="medida mutado" style={{ margin: "16px 0 0" }}>
                Cada proposta é montada para a realidade da sua empresa. Os valores não ficam no site: peça a sua pelo WhatsApp ou por e-mail.
              </p>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {FORMATOS.map((f) => (
                <li key={f} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--gray-bg)", borderRadius: 12, padding: "14px 18px" }}>
                  <CheckCircle2 aria-hidden="true" size={22} style={{ flex: "none", color: "var(--green-text)", marginTop: 1 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <ChamadaContato />
      </main>
      <Rodape />
    </>
  );
}
