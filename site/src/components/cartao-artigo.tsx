import Link from "next/link";
import { dataBR, minutos, type Artigo } from "@/lib/artigos";
import { imagemDefinitiva } from "@/lib/imagens";

/** Cartão de artigo com a foto de capa (lista e "Leia também"). */
export function CartaoArtigo({ a, destaque = false, breve = false }: { a: Artigo; destaque?: boolean; breve?: boolean }) {
  const capa = imagemDefinitiva(a.capa);
  const conteudo = (
    <>
        <span className="artigo-card__capa" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- site estático, imagem já em WebP */}
          {capa ? <img src={capa} alt="" loading="lazy" width={800} height={500} /> : null}
          <span>{a.categoria}</span>
        </span>
        <span className="artigo-card__texto">
          <span className="artigo-card__titulo">{a.titulo}</span>
          <span className="mutado">{a.descricao}</span>
          <span className="artigo-card__meta">
            {breve ? "Em breve" : dataBR(a.publicado)} · {minutos(a)} min de leitura{a.situacao === "rascunho" ? " · RASCUNHO" : ""}
          </span>
          <span className="artigo-card__ler">{breve ? `Publicação prevista para ${dataBR(a.publicado)}` : "Ler artigo →"}</span>
        </span>
    </>
  );
  const classe = ["card artigo-card", destaque ? "artigo-card--destaque" : "", breve ? "artigo-card--breve" : ""].filter(Boolean).join(" ");
  return (
    <li className={classe}>
      {breve ? <div>{conteudo}</div> : <Link href={`/artigos/${a.slug}/`}>{conteudo}</Link>}
    </li>
  );
}
