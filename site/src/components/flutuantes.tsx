"use client";

import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle } from "lucide-react";
import { whatsapp } from "@/content/empresa";

/**
 * Botões fixos à direita: WhatsApp e voltar ao topo. No celular, o WhatsApp só aparece depois de uma pequena rolagem,
 * para não cobrir o cartão do Audita PRO no topo da home (conferência de 24/10/2026).
 */
export function Flutuantes() {
  const [topo, setTopo] = useState(false);
  const [whats, setWhats] = useState(false);
  useEffect(() => {
    const celular = window.matchMedia("(max-width: 767px)");
    const aoRolar = () => {
      setTopo(window.scrollY > 600);
      setWhats(!celular.matches || window.scrollY > 160);
    };
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
      {whats && (
      <a className="flutuante flutuante--whats" href={whatsapp()} target="_blank" rel="noopener" aria-label="Conversar pelo WhatsApp (abre em nova aba)">
        <MessageCircle aria-hidden="true" />
      </a>
      )}
    </div>
  );
}
