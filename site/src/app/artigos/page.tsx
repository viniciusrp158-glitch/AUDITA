import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { CartaoArtigo } from "@/components/cartao-artigo";
import { ChamadaContato, HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { listarArtigos } from "@/lib/artigos";

export const metadata: Metadata = {
  title: "Artigos sobre Segurança do Trabalho, Meio Ambiente e SGI",
  description:
    "Artigos da equipe técnica da AUDITA sobre PGR, NRs, EPIs, CIPA, licenças ambientais, resíduos e sistemas de gestão, com as fontes oficiais citadas.",
  alternates: { canonical: "/artigos/" },
};

/**
 * Lista de artigos (plano aprovado pelo Diretor em 24/11/2026). Sem espaços vazios: até 2 artigos, dois cartões grandes
 * lado a lado; a partir de 3, o mais novo em destaque e os demais em grade que ocupa a largura toda.
 */
export default function Artigos() {
  const artigos = listarArtigos();
  const categorias = [...new Set(artigos.map((a) => a.categoria))];
  const [primeiro, ...resto] = artigos;
  return (
    <>
      <Cabecalho ativo="A AUDITA" />
      <main>
        <HeroInterno
          id="artigos-titulo"
          migalhas={[{ rotulo: "Artigos" }]}
          kicker="Conteúdo AUDITA"
          titulo="Artigos"
          resumo="Segurança do Trabalho, Meio Ambiente e Sistemas de Gestão explicados para pequenas e médias empresas, com a legislação vigente e as fontes oficiais citadas."
          foto={{ codigo: "IMG-09", descricao: "documentos organizados" }}
        >
          {categorias.length ? (
            <ul className="artigos-temas" aria-label="Temas">
              {categorias.map((c) => (
                <li key={c}>{c}</li>
              ))}
              <li>{artigos.length} {artigos.length === 1 ? "artigo" : "artigos"}</li>
            </ul>
          ) : null}
        </HeroInterno>
        <section className="secao secao--cinza artigos-secao" aria-label="Lista de artigos">
          <div className="container">
            {artigos.length === 0 ? (
              <p className="medida">Os primeiros artigos estão a caminho.</p>
            ) : artigos.length <= 2 ? (
              <ul className="artigos-lista artigos-lista--2">
                {artigos.map((a) => (
                  <CartaoArtigo key={a.slug} a={a} />
                ))}
              </ul>
            ) : (
              <>
                <ul className="artigos-lista">
                  <CartaoArtigo a={primeiro} destaque />
                </ul>
                <ul className="artigos-lista artigos-lista--auto" style={{ marginTop: 24 }}>
                  {resto.map((a) => (
                    <CartaoArtigo key={a.slug} a={a} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
        <ChamadaContato mensagem="Olá! Li os artigos do site e quero falar com a AUDITA." />
      </main>
      <Rodape />
    </>
  );
}
