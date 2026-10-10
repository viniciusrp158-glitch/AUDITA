"use client";

import { useEffect } from "react";

/** Avisos de sucesso que chegam pela URL (ex.: ?criada=1) aparecem uma vez; depois a URL é limpa, para que o aviso
 *  não continue na tela após as ações seguintes (achado H-02 da homologação). Filtros e buscas não são tocados. */
const FLASH = ["criada", "criado", "salva", "salvo", "item", "fluxo", "publicada", "recusada", "cancelada", "novo", "erro", "erro_cotacao", "confirmar"];

export function ClearFlashParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const k of FLASH)
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        changed = true;
      }
    if (changed) window.history.replaceState(window.history.state, "", url.pathname + (url.search ? url.search : "") + url.hash);
  });
  return null;
}
