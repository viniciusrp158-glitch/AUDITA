"use client";

import { Children, useEffect, useState } from "react";

/** Destaque rotativo do topo: troca a cada 7 s, para ao passar o mouse e não gira com "reduzir movimento" ligado. */
export function Destaques({ children }: { children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const [atual, setAtual] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || pausa || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setAtual((i) => (i + 1) % slides.length), 7000);
    return () => window.clearInterval(t);
  }, [slides.length, pausa]);
  return (
    <div onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      {slides.map((s, i) => (
        <div key={i} hidden={i !== atual} className="animate-[entrar_.5s_ease_both] motion-reduce:animate-none">
          {s}
        </div>
      ))}
      {slides.length > 1 && (
        <div className="mt-8 flex gap-2" role="group" aria-label="Destaques">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAtual(i)}
              aria-label={`Destaque ${i + 1} de ${slides.length}`}
              aria-current={i === atual}
              className="flex h-6 w-10 items-center"
            >
              <span className={`block h-1.5 w-full rounded-full ${i === atual ? "bg-green" : "bg-white/35"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
