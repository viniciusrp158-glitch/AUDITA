import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { ChamadaContato, HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { dataBR, listarArtigos, minutos } from "@/lib/artigos";

export const metadata: Metadata = {
  title: "Artigos sobre Segurança do Trabalho, Meio Ambiente e SGI",
  description:
    "Artigos da equipe técnica da AUDITA sobre PGR, NRs, EPIs, CIPA, licenças ambientais, resíduos e sistemas de gestão, com as fontes oficiais citadas.",
  alternates: { canonical: "/artigos/" },
};

/** Lista de artigos (plano de artigos aprovado pelo Diretor em 24/11/2026). */
export default function Artigos() {
  const artigos = listarArtigos();
  return (
    <>
      <Cabecalho ativo="A AUDITA" />
      <main>
        <HeroInterno
          id="artigos-titulo"
          migalhas={[{ rotulo: "Artigos" }]}
          kicker="Conteúdo AUDITA"
          titulo="Artigos"
          resumo="Segurança do Trabalho, Meio Ambiente e Sistemas de Gestão explicados para pequenas e médias empresas, com as fontes oficiais citadas."
          foto={{ codigo: "IMG-09", descricao: "documentos organizados" }}
        />
        <section className="secao" aria-label="Lista de artigos">
          <div className="container">
            {artigos.length === 0 ? (
              <p className="medida">Os primeiros artigos estão a caminho.</p>
            ) : (
              <ul className="grade grade--3 artigos-lista">
                {artigos.map((a) => (
                  <li key={a.slug} className="card artigo-card">
                    <Link href={`/artigos/${a.slug}/`}>
                      <span className="artigo-card__capa" aria-hidden="true">
                        <span>{a.categoria}</span>
                      </span>
                      <span className="artigo-card__texto">
                        <span className="artigo-card__titulo">{a.titulo}</span>
                        <span className="mutado">{a.descricao}</span>
                        <span className="artigo-card__meta">
                          {dataBR(a.publicado)} · {minutos(a)} min de leitura{a.situacao === "rascunho" ? " · RASCUNHO" : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <ChamadaContato mensagem="Olá! Li os artigos do site e quero falar com a AUDITA." />
      </main>
      <Rodape />
    </>
  );
}
