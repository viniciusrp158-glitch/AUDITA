"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia um texto (código ou link de verificação do certificado). */
export function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          window.setTimeout(() => setOk(false), 2000);
        } catch {
          window.prompt("Copie:", texto);
        }
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-navy"
    >
      {ok ? <Check size={16} className="text-ok" aria-hidden /> : <Copy size={16} aria-hidden />}
      {ok ? "Copiado" : rotulo}
    </button>
  );
}
