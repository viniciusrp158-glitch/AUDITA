import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { ChamadaContato, HeroInterno } from "@/components/pagina";
import { Foto } from "@/components/wireframe";
import { whatsapp } from "@/content/empresa";
import { FAMILIAS, familia as buscarFamilia, servicosPublicados } from "@/content/servicos";

/** Página de uma família de serviços (briefing, seção 7): todos os serviços publicados, com o limite de cada um. */

export const dynamicParams = false;

export function generateStaticParams() {
  return FAMILIAS.map((f) => ({ familia: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ familia: string }> }): Promise<Metadata> {
  const f = buscarFamilia((await params).familia);
  return f ? { title: f.nome, description: f.resumo, alternates: { canonical: `/solucoes/${f.slug}/` } } : {};
}

export default async function PaginaFamilia({ params }: { params: Promise<{ familia: string }> }) {
  const f = buscarFamilia((await params).familia);
  if (!f) notFound();
  const servicos = servicosPublicados(f);
  const outras = FAMILIAS.filter((o) => o.slug !== f.slug);
  return (
    <>
      <Cabecalho ativo="Soluções" />
      <main>
        <HeroInterno
          id="familia-titulo"
          migalhas={[{ rotulo: "Soluções", href: "/solucoes/" }, { rotulo: f.nome }]}
          kicker={f.pilar}
          titulo={f.nome}
          resumo={f.resumo}
          foto={{ "Segurança e Saúde do Trabalho": { codigo: "IMG-21", descricao: "trabalhador com EPI completo em inspeção" }, "Meio Ambiente": { codigo: "IMG-22", descricao: "gestão de resíduos em ambiente industrial" }, "Sistemas de Gestão (SGI)": { codigo: "IMG-23", descricao: "auditor com tablet conversando com gestor na produção" } }[f.pilar]}
        />

        <section className="secao" aria-labelledby="servicos-titulo">
                    <div className="container">
            <p className="kicker">Serviços</p>
            <h2 id="servicos-titulo" className="t2">O que fazemos</h2>
            {f.aviso ? <p className="aviso" style={{ margin: "20px 0 0" }}>{f.aviso}</p> : null}
            <div className="grade grade--3" style={{ marginTop: 32 }}>
              {servicos.map((s) => (
                <article key={s.codigo} className="card" data-revelar="">
                  <div className="card__corpo" style={{ height: "100%", boxSizing: "border-box" }}>
                    <h3 className="t3" style={{ fontSize: 20 }}>{s.nome}</h3>
                    <p className="mutado" style={{ margin: 0, fontSize: 15, flex: 1 }}>{s.descricao}</p>
                    <a className="btn btn--contorno" style={{ alignSelf: "flex-start" }} href={whatsapp(`Olá! Quero uma proposta de ${s.nome}.`)} target="_blank" rel="noopener">
                      Solicitar proposta
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {f.extra ? (
              <div style={{ marginTop: 48 }}>
                <h3 className="t3">{f.extra.titulo}</h3>
                <ul className="grade grade--3" style={{ listStyle: "none", padding: 0, margin: "16px 0 0", gap: 8 }}>
                  {f.extra.itens.map((i) => <li key={i} style={{ background: "var(--gray-bg)", borderRadius: 8, padding: "10px 14px", fontWeight: 500 }}>{i}</li>)}
                </ul>
                <p className="mutado" style={{ margin: "12px 0 0", fontSize: 14 }}>{f.extra.nota}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="secao secao--cinza" aria-labelledby="como-titulo">
          <div className="container grade grade--2 grade--meio">
            <div>
              <h2 id="como-titulo" className="t2">Como contratar</h2>
              <p className="medida" style={{ margin: "20px 0 0" }}>
                Consultoria mensal ou atendimento pontual, documentos e auditorias por projeto e treinamentos por turma. Conte o que a sua empresa precisa e a AUDITA monta a proposta.
              </p>
              <div className="acoes">
                <a className="btn btn--escuro btn--bloco" href={whatsapp(`Olá! Quero uma proposta de ${f.nome}.`)} target="_blank" rel="noopener">Solicitar proposta</a>
              </div>
            </div>
            <Foto codigo={{ "Segurança e Saúde do Trabalho": "IMG-03", "Meio Ambiente": "IMG-04", "Sistemas de Gestão (SGI)": "IMG-05" }[f.pilar]} descricao={{ "Segurança e Saúde do Trabalho": "inspeção de campo com EPI", "Meio Ambiente": "coleta seletiva ou resíduos em ambiente industrial", "Sistemas de Gestão (SGI)": "auditoria com checklist e documentos" }[f.pilar]} className="foto--redonda" style={{ height: 320 }} />
          </div>
        </section>

        <section className="secao" style={{ paddingTop: 56, paddingBottom: 56 }} aria-labelledby="outras-titulo">
          <div className="container">
            <h2 id="outras-titulo" className="t3">Outras soluções</h2>
            <ul className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "20px 0 0", gap: 12 }}>
              {outras.map((o) => (
                <li key={o.slug}>
                  <a href={`/solucoes/${o.slug}/`} className="card" style={{ display: "block", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px", fontWeight: 600, textDecoration: "none" }}>{o.nome}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <ChamadaContato mensagem={`Olá! Quero uma proposta de ${f.nome}.`} />
      </main>
      <Rodape />
    </>
  );
}
