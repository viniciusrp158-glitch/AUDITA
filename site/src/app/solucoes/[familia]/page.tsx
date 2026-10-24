import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Curva, Foto, Tag } from "@/components/wireframe";
import { MAILTO, whatsapp } from "@/content/empresa";
import { FAMILIAS, familia as buscarFamilia, servicosPublicados } from "@/content/servicos";

/** Página de uma família de serviços (briefing, seção 7): todos os serviços publicados, com o limite de cada um. */

export const dynamicParams = false;

export function generateStaticParams() {
  return FAMILIAS.map((f) => ({ familia: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ familia: string }> }): Promise<Metadata> {
  const f = buscarFamilia((await params).familia);
  return f ? { title: f.nome, description: f.resumo } : {};
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
        <section className="hero hero--interna" aria-labelledby="familia-titulo">
          <Tag>Hero menor com foto e curva</Tag>
          <div className="hero__foto">Foto da página (IMG-21 a IMG-23, conforme o pilar), escurecida</div>
          <div className="container" style={{ position: "relative" }}>
            <nav aria-label="Você está em" className="migalhas">
              <Link href="/">Início</Link>
              <span aria-hidden="true">›</span>
              <Link href="/#solucoes">Soluções</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page">{f.nome}</span>
            </nav>
            <p className="kicker">{f.pilar}</p>
            <h1 id="familia-titulo" className="t1">{f.nome}</h1>
            <p className="texto-grande medida" style={{ margin: "20px 0 0" }}>{f.resumo}</p>
          </div>
          <Curva />
        </section>

        <section className="secao" aria-labelledby="servicos-titulo">
          <Tag>Serviços da família</Tag>
          <div className="container">
            <p className="kicker">Serviços</p>
            <h2 id="servicos-titulo" className="t2">O que fazemos</h2>
            {f.aviso ? <p className="aviso" style={{ margin: "20px 0 0" }}>{f.aviso}</p> : null}
            <div className="grade grade--3" style={{ marginTop: 32 }}>
              {servicos.map((s) => (
                <article key={s.codigo} className="card">
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
            <p className="mutado" style={{ margin: "24px 0 0", fontSize: 14 }}>Sem preços no site: cada pedido de proposta vai pelo WhatsApp com o nome do serviço.</p>
          </div>
        </section>

        <section className="secao secao--cinza" aria-labelledby="como-titulo">
          <Tag>Bloco texto + imagem</Tag>
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
            <Foto codigo="IMG-2x" descricao="foto do pilar da página" className="foto--redonda" style={{ height: 320 }} />
          </div>
        </section>

        <section className="secao" style={{ paddingTop: 56, paddingBottom: 56 }} aria-labelledby="outras-titulo">
          <Tag>Outras soluções</Tag>
          <div className="container">
            <h2 id="outras-titulo" className="t3">Outras soluções</h2>
            <ul className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "20px 0 0", gap: 12 }}>
              {outras.map((o) => (
                <li key={o.slug}>
                  <a href={`/solucoes/${o.slug}/`} style={{ display: "block", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px", fontWeight: 600, textDecoration: "none" }}>{o.nome}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="secao secao--escura" style={{ paddingTop: 56, paddingBottom: 56 }} aria-labelledby="cta-titulo">
          <Tag>Chamada de contato</Tag>
          <div className="container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
            <h2 id="cta-titulo" className="t2" style={{ flex: "1 1 420px" }}>Vamos organizar a segurança da sua empresa?</h2>
            <div className="acoes" style={{ marginTop: 0 }}>
              <a className="btn btn--principal btn--grande btn--bloco" href={whatsapp()} target="_blank" rel="noopener">Fale pelo WhatsApp</a>
              <a className="btn btn--contorno-claro btn--grande btn--bloco" href={MAILTO}>Enviar e-mail</a>
            </div>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
