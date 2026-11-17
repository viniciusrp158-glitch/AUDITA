"use client";

import { useEffect, useRef, useState } from "react";

const W = 1123;
const H = 794;

/** Mostra uma página do certificado (A4 deitado, 1123 × 794) inteira na largura disponível; na impressão sai no tamanho real. */
export function CertificateFit({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
    <div ref={box} className="w-full print:w-auto">
      <div className={`overflow-hidden print:!h-auto print:overflow-visible ${className}`} style={{ height: H * scale, width: W * scale }}>
        <div className="origin-top-left print:!transform-none" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
