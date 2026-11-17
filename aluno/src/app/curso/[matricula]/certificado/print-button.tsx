"use client";

import { Printer } from "lucide-react";

/** Abre a impressão do navegador (imprimir ou salvar em PDF). */
export function PrintButton({ rotulo = "Imprimir ou salvar em PDF" }: { rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-navy px-4 text-sm font-bold text-white hover:bg-navy-700"
    >
      <Printer size={16} aria-hidden /> {rotulo}
    </button>
  );
}
