"use client";

import { useEffect, useRef, useState } from "react";

const W = 1123;
const H = 794;

/** Mostra o certificado (A4 deitado, 1123 × 794) inteiro na largura disponível; na impressão sai no tamanho real. */
export function CertificateFit({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="w-full overflow-hidden print:!h-auto print:overflow-visible" style={{ height: H * scale }}>
      <div className="origin-top-left print:!transform-none" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
