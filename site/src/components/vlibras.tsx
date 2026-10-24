"use client";

import Script from "next/script";

/** Widget VLibras (tradução para Libras, gov.br), pedido no briefing (10.5). Carrega depois da página. */
export function VLibras() {
  return (
    <>
      <div {...{ vw: "" }} className="enabled">
        <div {...{ "vw-access-button": "" }} className="active" />
        <div {...{ "vw-plugin-wrapper": "" }}>
          <div className="vw-plugin-top-wrapper" />
        </div>
      </div>
      <Script
        src="https://vlibras.gov.br/app/vlibras-plugin.js"
        strategy="lazyOnload"
        onLoad={() => {
          const w = window as unknown as { VLibras?: { Widget: new (url: string) => unknown } };
          if (w.VLibras) new w.VLibras.Widget("https://vlibras.gov.br/app");
        }}
      />
    </>
  );
}
