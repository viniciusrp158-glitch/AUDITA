import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, CalendarCheck, MessageCircle } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { CartaoArtigo } from "@/components/cartao-artigo";
import { Markdown, titulosDoArtigo } from "@/components/markdown";
import { HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { whatsapp } from "@/content/empresa";
import { dataBR, listarArtigos, minutos, obterArtigo, type Artigo } from "@/lib/artigos";
import { imagemDefinitiva } from "@/lib/imagens";

export const dynamicParams = false;

export function generateStaticParams() {
  const artigos = listarArtigos();
  // Sem artigo publicado, o build estático ainda precisa de um endereço: a página "_vazio" responde 404
  return artigos.length ? artigos.map((a) => ({ slug: a.slug })) : [{ slug: "_vazio" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = obterArtigo((await params).slug);
  if (!a) return { robots: { index: false, follow: false } };
  const capa = imagemDefinitiva(a.capa);
  return {
    title: a.titulo,
    description: a.descricao,
    alternates: { canonical: `/artigos/${a.slug}/` },
    robots: a.situacao === "rascunho" ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      locale: "pt_BR",
      siteName: "AUDITA | SSMA & SGI",
      title: a.titulo,
      description: a.descricao,
      url: `/artigos/${a.slug}/`,
      publishedTime: a.publicado,
      modifiedTime: a.revisado,
      ...(capa ? { images: [{ url: capa, alt: a.titulo }] } : {}),
    },
  };
}

function Convite({ a, lateral = false }: { a: Artigo; lateral?: boolean }) {
  return (
    <aside className={lateral ? "artigo__convite artigo__convite--lateral" : "artigo__convite"} aria-label="Fale com a AUDITA">
      <p className="artigo__convite-titulo">Quer ajuda com isso na sua empresa?</p>
      <p>A AUDITA apoia pequenas e médias empresas na rotina de Segurança, Saúde e Meio Ambiente.</p>
      <div className="artigo__convite-botoes">
        <a className="btn btn--principal btn--bloco" href={whatsapp(a.convite)} target="_blank" rel="noopener">
          <MessageCircle aria-hidden="true" size={18} /> Falar pelo WhatsApp
        </a>
        <Link className="btn btn--contorno-claro btn--bloco" href={a.servico}>{a.servicoRotulo}</Link>
      </div>
    </aside>
  );
}

/**
 * Página do artigo. No computador: texto à esquerda e coluna lateral fixa (sumário, convite e data da conferência da
 * legislação), sem margens vazias (pedido do Diretor, 24/11/2026). No celular: sumário recolhível no topo e convite no fim.
 */
export default async function PaginaArtigo({ params }: { params: Promise<{ slug: string }> }) {
  const a = obterArtigo((await params).slug);
  if (!a) notFound();
  const outros = listarArtigos().filter((o) => o.slug !== a.slug).slice(0, 3);
  const sumario = titulosDoArtigo(a.corpo);
  const capa = imagemDefinitiva(a.capa);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titulo,
    description: a.descricao,
    datePublished: a.publicado,
    dateModified: a.revisado,
    inLanguage: "pt-BR",
    ...(capa ? { image: `https://audita.seg.br${capa}` } : {}),
    mainEntityOfPage: `https://audita.seg.br/artigos/${a.slug}/`,
    author: { "@type": "Organization", name: "Equipe técnica AUDITA", url: "https://audita.seg.br/" },
    publisher: { "@type": "Organization", name: "AUDITA | SSMA & SGI", logo: { "@type": "ImageObject", url: "https://audita.seg.br/images/marca/audita-positiva.webp" } },
  };
  const listaSumario = (
    <ol>
      {sumario.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`}>{s.texto}</a>
        </li>
      ))}
    </ol>
  );
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
          foto={{ codigo: a.capa, descricao: a.titulo }}
        >
          <p className="artigo__meta-hero">
            Equipe técnica AUDITA · {dataBR(a.publicado)} · {minutos(a)} min de leitura
            {a.situacao === "rascunho" ? " · RASCUNHO (não publicado)" : ""}
          </p>
        </HeroInterno>
        <article className="secao artigo-secao" aria-labelledby="artigo-titulo">
          <div className="container artigo-grade">
            <div className="artigo">
              {sumario.length > 2 ? (
                <details className="artigo__sumario artigo__sumario--celular">
                  <summary>Neste artigo</summary>
                  {listaSumario}
                </details>
              ) : null}
              <div className="artigo__corpo">
                <Markdown texto={a.corpo} />
              </div>
              <div className="artigo__fim-celular">
                <Convite a={a} />
              </div>
              <p className="artigo__aviso mutado">
                Conteúdo informativo, com base nas fontes citadas, conferidas em {dataBR(a.consultado)}. Não substitui a
                análise de um profissional habilitado para o caso da sua empresa.
              </p>
            </div>
            <div className="artigo-lateral">
              <div className="artigo-lateral__fixa">
                {sumario.length > 2 ? (
                  <nav className="artigo__sumario" aria-label="Neste artigo">
                    <p><BookOpenCheck aria-hidden="true" size={18} /> Neste artigo</p>
                    {listaSumario}
                  </nav>
                ) : null}
                <Convite a={a} lateral />
                <p className="artigo-lateral__nota">
                  <CalendarCheck aria-hidden="true" size={18} />
                  <span>
                    Legislação vigente conferida em <strong>{dataBR(a.consultado)}</strong>
                    {a.revisado !== a.publicado ? `. Revisado em ${dataBR(a.revisado)}` : ""}.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </article>
        {outros.length ? (
          <section className="secao secao--cinza" aria-labelledby="outros-titulo">
            <div className="container">
              <h2 id="outros-titulo" className="t2">Leia também</h2>
              <ul className="artigos-lista artigos-lista--auto" style={{ marginTop: 24 }}>
                {outros.map((o) => (
                  <CartaoArtigo key={o.slug} a={o} />
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
