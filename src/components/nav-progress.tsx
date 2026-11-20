"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barra de progresso no topo (AUDDOC020 Rev.01, RNF-P06: aviso de carregamento imediato). Aparece no toque num link
 * interno e some quando a nova página chega. Não usa loading.tsx: o limite de carregamento do Next.js quebrava os
 * links que mudam só os filtros ("?grupo=…") depois de uma navegação interna (verificado em 19/11/2026).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || /^(mailto|tel|https?):/i.test(href)) return;
      const next = new URL(a.href, location.href);
      if (next.origin !== location.origin || (next.pathname === location.pathname && next.search === location.search)) return;
      setActive(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 15000); // nunca fica presa
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
      <div className={`h-full bg-green ${active ? "animate-[navprog_1.2s_ease-in-out_infinite]" : ""}`} style={{ width: "40%" }} />
    </div>
  );
}
