"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Carrossel com swipe (scroll-snap), setas e bolinhas. Cada filho é um slide. `aoMudar` avisa o slide ativo
 * (a seção "O que resolvemos" troca o fundo com ele).
 */
export function Carrossel({ rotulo, children, escuro = false, aoMudar }: { rotulo: string; children: React.ReactNode[]; escuro?: boolean; aoMudar?: (i: number) => void }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  const marcar = (i: number) => {
    setAtual(i);
    aoMudar?.(i);
  };

  const irPara = (i: number) => {
    const el = trilho.current;
    const destino = Math.max(0, Math.min(children.length - 1, i));
    const alvo = el?.children[destino] as HTMLElement | undefined;
    if (el && alvo) el.scrollTo({ left: alvo.offsetLeft - el.offsetLeft, behavior: "smooth" });
    marcar(destino);
  };

  const aoRolar = () => {
    const el = trilho.current;
    if (!el) return;
    const largura = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
    const i = Math.min(children.length - 1, Math.round(el.scrollLeft / (largura + 16)));
    if (i !== atual) marcar(i);
  };

  const corBotao = escuro ? "btn btn--contorno-claro" : "btn btn--contorno";
  return (
    <div role="region" aria-roledescription="carrossel" aria-label={rotulo}>
      <div ref={trilho} className="trilho" onScroll={aoRolar}>
        {children.map((filho, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${children.length}`}>
            {filho}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 24 }}>
        <div className="pontos">
          {children.map((_, i) => (
            <button key={i} type="button" className="ponto" aria-label={`Ir para o slide ${i + 1}`} aria-current={i === atual} onClick={() => irPara(i)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" className={corBotao} style={{ padding: "0 12px" }} aria-label="Anterior" onClick={() => irPara(atual - 1)}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className={corBotao} style={{ padding: "0 12px" }} aria-label="Próximo" onClick={() => irPara(atual + 1)}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
