"use client";

import { useState } from "react";
import Script from "next/script";
import { Hand } from "lucide-react";

type VLibrasWindow = { VLibras?: { Widget: new (url: string) => unknown } };

/**
 * Widget VLibras (tradução para Libras, gov.br), pedido no briefing (10.5).
 * Auditoria de segurança (25/10/2026): o script do gov.br roda na mesma origem do sistema (audita.seg.br), então só é
 * carregado quando o visitante pede, pelo botão "Libras". Depois de carregado, o próprio botão do VLibras assume.
 */
export function VLibras() {
  const [ativo, setAtivo] = useState(false);
  return (
    <>
      {!ativo && (
        <button type="button" className="vlibras-ativar" onClick={() => setAtivo(true)} aria-label="Ativar o tradutor de Libras (VLibras, gov.br)">
          <Hand aria-hidden="true" />
          <span>Libras</span>
        </button>
      )}
      {ativo && (
        <>
          <div {...{ vw: "" }} className="enabled">
            <div {...{ "vw-access-button": "" }} className="active" />
            <div {...{ "vw-plugin-wrapper": "" }}>
              <div className="vw-plugin-top-wrapper" />
            </div>
          </div>
          <Script
            src="https://vlibras.gov.br/app/vlibras-plugin.js"
            strategy="afterInteractive"
            onLoad={() => {
              const w = window as unknown as VLibrasWindow;
              if (!w.VLibras) return;
              new w.VLibras.Widget("https://vlibras.gov.br/app");
              // Abre o tradutor de uma vez (quem clicou em "Libras" já pediu); se ainda não estiver pronto, o botão do
              // VLibras fica na tela para um novo clique
              window.setTimeout(() => document.querySelector<HTMLElement>("[vw-access-button]")?.click(), 800);
            }}
          />
        </>
      )}
    </>
  );
}
