import Link from "next/link";
import { dataBR, minutos, type Artigo } from "@/lib/artigos";
import { imagemDefinitiva } from "@/lib/imagens";

/** Cartão de artigo com a foto de capa (lista e "Leia também"). */
export function CartaoArtigo({ a, destaque = false }: { a: Artigo; destaque?: boolean }) {
  const capa = imagemDefinitiva(a.capa);
  return (
    <li className={destaque ? "card artigo-card artigo-card--destaque" : "card artigo-card"}>
      <Link href={`/artigos/${a.slug}/`}>
        <span className="artigo-card__capa" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- site estático, imagem já em WebP */}
          {capa ? <img src={capa} alt="" loading="lazy" width={800} height={500} /> : null}
          <span>{a.categoria}</span>
        </span>
        <span className="artigo-card__texto">
          <span className="artigo-card__titulo">{a.titulo}</span>
          <span className="mutado">{a.descricao}</span>
          <span className="artigo-card__meta">
            {dataBR(a.publicado)} · {minutos(a)} min de leitura{a.situacao === "rascunho" ? " · RASCUNHO" : ""}
          </span>
          <span className="artigo-card__ler">Ler artigo →</span>
        </span>
      </Link>
    </li>
  );
}
