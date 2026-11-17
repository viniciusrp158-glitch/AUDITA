"use client";

import { useEffect, useRef } from "react";

/**
 * Caixa de altura fixa do certificado: se o nome (ou o título do curso) for longo demais,
 * reduz primeiro o nome (até 62% do tamanho) e depois o texto, até tudo caber sem invadir o selo.
 */
export function FitBox({ className, children }: { className: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const name = el.querySelector<HTMLElement>("[data-fit=name]");
      const text = el.querySelector<HTMLElement>("[data-fit=text]");
      for (const n of [name, text]) n?.style.removeProperty("font-size");
      const over = () => el.scrollHeight > el.clientHeight + 1;
      if (name) {
        let size = parseFloat(getComputedStyle(name).fontSize);
        const min = size * 0.62;
        while (over() && size > min) {
          size -= 1;
          name.style.fontSize = `${size}px`;
        }
      }
      if (text) {
        let size = parseFloat(getComputedStyle(text).fontSize);
        while (over() && size > 11) {
          size -= 0.3;
          text.style.fontSize = `${size}px`;
        }
      }
    };
    fit();
    document.fonts?.ready.then(fit);
  }, []);
  return (
    <div ref={box} className={className}>
      {children}
    </div>
  );
}
