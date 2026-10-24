"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Carrossel com swipe (scroll-snap), setas e bolinhas. Cada filho é um slide. */
export function Carrossel({ rotulo, children, escuro = false }: { rotulo: string; children: React.ReactNode[]; escuro?: boolean }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  const irPara = (i: number) => {
    const el = trilho.current;
    const alvo = el?.children[Math.max(0, Math.min(children.length - 1, i))] as HTMLElement | undefined;
    if (el && alvo) el.scrollTo({ left: alvo.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  const aoRolar = () => {
    const el = trilho.current;
    if (!el) return;
    const largura = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
    setAtual(Math.round(el.scrollLeft / (largura + 16)));
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
            <button
              key={i}
              type="button"
              className="ponto"
              aria-label={`Ir para o slide ${i + 1}`}
              aria-current={i === atual}
              style={escuro ? undefined : { background: i === atual ? "var(--navy)" : "#bdbdbd" }}
              onClick={() => irPara(i)}
            />
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
