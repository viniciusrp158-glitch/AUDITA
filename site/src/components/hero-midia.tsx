"use client";

import { useEffect, useState } from "react";
import { imagemDefinitiva, videoDefinitivo } from "@/lib/imagens";
import { PAINEL, PAINEL_INTERVALO } from "@/content/painel";

/**
 * Fundo do hero da home (IMG-01 + painel principal): vídeo curto em loop e mudo quando existir img-01.mp4; senão a foto
 * img-01 (e a vertical img-01m no celular), seguida das fotos do painel (content/painel.ts) em transição suave, no estilo
 * Ambipar. Sem vídeo nem rodízio para quem pede "reduzir movimento"; sem vídeo em conexão lenta/economia de dados
 * (briefing 10.3 e 10.4). As fotos do painel só entram depois da primeira pintura, para não pesar no carregamento.
 */
export function HeroMidia() {
  const foto = imagemDefinitiva("IMG-01");
  const fotoCelular = imagemDefinitiva("IMG-01m");
  const video = videoDefinitivo("IMG-01");
  const [tocarVideo, setTocarVideo] = useState(false);
  const [rodizio, setRodizio] = useState(false);
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (video) {
      const conexao = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const lenta = conexao?.saveData || /(^|-)2g$|3g/.test(conexao?.effectiveType ?? "");
      setTocarVideo(!lenta && !reduzir);
    }
    if (!reduzir && PAINEL.length > 0) setRodizio(true);
  }, [video]);

  const total = 1 + (rodizio ? PAINEL.length : 0);
  useEffect(() => {
    if (!rodizio || tocarVideo) return;
    const t = window.setInterval(() => setAtivo((a) => (a + 1) % total), PAINEL_INTERVALO);
    return () => window.clearInterval(t);
  }, [rodizio, tocarVideo, total]);

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
    <div className="hero__foto hero__painel" aria-hidden="true" style={{ padding: 0 }}>
      {tocarVideo && video ? (
        <video src={video} poster={foto} autoPlay muted loop playsInline style={cobrir} />
      ) : (
        <>
          <picture className={ativo === 0 ? "painel__slide ativo" : "painel__slide"}>
            {fotoCelular ? <source media="(max-width: 767px)" srcSet={fotoCelular} /> : null}
            <img src={foto ?? fotoCelular} alt="" fetchPriority="high" style={cobrir} />
          </picture>
          {rodizio &&
            PAINEL.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- site estático (export)
              <img
                key={p.src}
                className={ativo === i + 1 ? "painel__slide ativo" : "painel__slide"}
                src={p.src}
                alt=""
                decoding="async"
                fetchPriority="low"
                style={{ ...cobrir, objectPosition: p.foco ?? "50% 50%" }}
              />
            ))}
        </>
      )}
      <span style={{ position: "absolute", inset: 0, background: "var(--photo-overlay)" }} />
    </div>
  );
}
