"use client";

import { useEffect, useState } from "react";
import { imagemDefinitiva, videoDefinitivo } from "@/lib/imagens";

/**
 * Fundo do hero da home (IMG-01): vídeo curto em loop e mudo quando existir img-01.mp4; senão a foto img-01 (e a
 * vertical img-01m no celular). Sem vídeo para quem pede "reduzir movimento" ou está em conexão lenta/economia de
 * dados (briefing 10.3 e 10.4). Sem nenhum arquivo, mostra o espaço marcado com a descrição da imagem.
 */
export function HeroMidia() {
  const foto = imagemDefinitiva("IMG-01");
  const fotoCelular = imagemDefinitiva("IMG-01m");
  const video = videoDefinitivo("IMG-01");
  const [tocarVideo, setTocarVideo] = useState(false);

  useEffect(() => {
    if (!video) return;
    const conexao = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const lenta = conexao?.saveData || /(^|-)2g$|3g/.test(conexao?.effectiveType ?? "");
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTocarVideo(!lenta && !reduzir);
  }, [video]);

  if (!foto && !video) {
    return (
      <div className="hero__foto" aria-hidden="true">
        <span style={{ fontWeight: 700 }}>IMG-01 · imagem provisória</span>
        <span>vídeo de 10 a 15 s em loop, mudo: profissional de capacete conferindo um tablet (no celular, IMG-01m vertical)</span>
      </div>
    );
  }
  const cobrir: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  return (
    <div className="hero__foto" aria-hidden="true" style={{ padding: 0 }}>
      {tocarVideo && video ? (
        <video src={video} poster={foto} autoPlay muted loop playsInline style={cobrir} />
      ) : (
        <picture>
          {fotoCelular ? <source media="(max-width: 767px)" srcSet={fotoCelular} /> : null}
          <img src={foto ?? fotoCelular} alt="" fetchPriority="high" style={cobrir} />
        </picture>
      )}
      <span style={{ position: "absolute", inset: 0, background: "var(--photo-overlay)" }} />
    </div>
  );
}
