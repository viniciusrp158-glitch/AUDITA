import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/cabecalho";
import { Markdown, titulosDoArtigo } from "@/components/markdown";
import { HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { whatsapp } from "@/content/empresa";
import { dataBR, listarArtigos, minutos, obterArtigo } from "@/lib/artigos";

export const dynamicParams = false;

export function generateStaticParams() {
  const artigos = listarArtigos();
  // Sem artigo publicado, o build estático ainda precisa de um endereço: a página "_vazio" responde 404
  return artigos.length ? artigos.map((a) => ({ slug: a.slug })) : [{ slug: "_vazio" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = obterArtigo((await params).slug);
  if (!a) return { robots: { index: false, follow: false } };
  return {
    title: a.titulo,
    description: a.descricao,
    alternates: { canonical: `/artigos/${a.slug}/` },
    robots: a.situacao === "rascunho" ? { index: false, follow: false } : undefined,
    openGraph: { type: "article", locale: "pt_BR", siteName: "AUDITA | SSMA & SGI", title: a.titulo, description: a.descricao, url: `/artigos/${a.slug}/`, publishedTime: a.publicado, modifiedTime: a.revisado },
  };
}

/** Página do artigo: título, autoria da equipe técnica, sumário, texto, convite ligado a um serviço e outros artigos. */
export default async function PaginaArtigo({ params }: { params: Promise<{ slug: string }> }) {
  const a = obterArtigo((await params).slug);
  if (!a) notFound();
  const outros = listarArtigos().filter((o) => o.slug !== a.slug).slice(0, 3);
  const sumario = titulosDoArtigo(a.corpo);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titulo,
    description: a.descricao,
    datePublished: a.publicado,
    dateModified: a.revisado,
    inLanguage: "pt-BR",
    mainEntityOfPage: `https://audita.seg.br/artigos/${a.slug}/`,
    author: { "@type": "Organization", name: "Equipe técnica AUDITA", url: "https://audita.seg.br/" },
    publisher: { "@type": "Organization", name: "AUDITA | SSMA & SGI", logo: { "@type": "ImageObject", url: "https://audita.seg.br/images/marca/audita-positiva.webp" } },
  };
  return (
    <>
      <Cabecalho ativo="A AUDITA" />
      <main>
        <HeroInterno
          id="artigo-titulo"
          migalhas={[{ rotulo: "Artigos", href: "/artigos/" }, { rotulo: a.categoria }]}
          kicker={a.categoria}
          titulo={a.titulo}
          resumo={a.descricao}
          foto={{ codigo: "IMG-09", descricao: "documentos organizados" }}
        />
        <article className="secao" aria-labelledby="artigo-titulo">
          <div className="container artigo">
            <p className="artigo__meta">
              Equipe técnica AUDITA · Publicado em {dataBR(a.publicado)}
              {a.revisado !== a.publicado ? ` · Revisado em ${dataBR(a.revisado)}` : ""} · {minutos(a)} min de leitura
              {a.situacao === "rascunho" ? " · RASCUNHO (não publicado)" : ""}
            </p>
            {sumario.length > 2 ? (
              <nav className="artigo__sumario" aria-label="Neste artigo">
                <p>Neste artigo</p>
                <ol>{sumario.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.texto}</a></li>)}</ol>
              </nav>
            ) : null}
            <div className="artigo__corpo">
              <Markdown texto={a.corpo} />
            </div>
            <aside className="artigo__convite" aria-label="Fale com a AUDITA">
              <p className="artigo__convite-titulo">Quer ajuda com isso na sua empresa?</p>
              <p>A AUDITA apoia pequenas e médias empresas na rotina de Segurança, Saúde e Meio Ambiente.</p>
              <div className="acoes" style={{ marginTop: 16 }}>
                <a className="btn btn--principal btn--bloco" href={whatsapp(a.convite)} target="_blank" rel="noopener">Falar pelo WhatsApp</a>
                <Link className="btn btn--contorno btn--bloco" href={a.servico}>{a.servicoRotulo}</Link>
              </div>
            </aside>
            <p className="artigo__aviso mutado">
              Conteúdo informativo, com base nas fontes citadas na data da última revisão. Não substitui a análise de um
              profissional habilitado para o caso da sua empresa.
            </p>
          </div>
        </article>
        {outros.length ? (
          <section className="secao secao--cinza" aria-labelledby="outros-titulo">
            <div className="container">
              <h2 id="outros-titulo" className="t2">Leia também</h2>
              <ul className="grade grade--3" style={{ listStyle: "none", padding: 0, margin: "24px 0 0" }}>
                {outros.map((o) => (
                  <li key={o.slug} className="card" style={{ padding: 20 }}>
                    <p className="kicker" style={{ margin: 0 }}>{o.categoria}</p>
                    <Link href={`/artigos/${o.slug}/`} style={{ display: "block", marginTop: 8, fontWeight: 700, color: "var(--navy)" }}>{o.titulo}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </main>
      <Rodape />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </>
  );
}
