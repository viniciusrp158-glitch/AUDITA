"use client";

import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle } from "lucide-react";
import { whatsapp } from "@/content/empresa";

/** Botões fixos à direita: WhatsApp e voltar ao topo (o VLibras entra na Etapa 3). */
export function Flutuantes() {
  const [topo, setTopo] = useState(false);
  useEffect(() => {
    const aoRolar = () => setTopo(window.scrollY > 600);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);
  return (
    <div className="flutuantes">
      {topo && (
        <button type="button" className="flutuante flutuante--topo" aria-label="Voltar ao topo" onClick={() => window.scrollTo({ top: 0 })}>
          <ArrowUp aria-hidden="true" />
        </button>
      )}
      <a className="flutuante flutuante--whats" href={whatsapp()} target="_blank" rel="noopener" aria-label="Conversar pelo WhatsApp (abre em nova aba)">
        <MessageCircle aria-hidden="true" />
      </a>
    </div>
  );
}
