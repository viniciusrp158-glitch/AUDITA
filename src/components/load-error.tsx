"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

const RETRY_KEY = "audita-erro-retentativa";
const RETRY_WINDOW_MS = 20_000;

/**
 * Tela de erro ao carregar uma página. A causa mais comum é uma falha momentânea de conexão entre o navegador e o
 * servidor (ex.: erro 526 do Cloudflare): tenta de novo sozinha uma vez por endereço (no máximo uma a cada 20 s) e
 * oferece os botões para o usuário repetir.
 */
export function LoadError({ reset, digest }: { reset: () => void; digest?: string }) {
  const router = useRouter();

  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    let last: { path?: string; at?: number } = {};
    try {
      last = JSON.parse(sessionStorage.getItem(RETRY_KEY) ?? "{}");
    } catch {
      // sem armazenamento: só não repete sozinho
      return;
    }
    const path = window.location.pathname;
    if (last.path === path && Date.now() - (last.at ?? 0) < RETRY_WINDOW_MS) return;
    try {
      sessionStorage.setItem(RETRY_KEY, JSON.stringify({ path, at: Date.now() }));
    } catch {
      return;
    }
    const t = setTimeout(retry, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="alert" className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6 text-center" data-testid="load-error">
      <h1 className="text-base font-semibold text-ink">Não foi possível carregar esta tela</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        A conexão com o servidor falhou por um instante. Nenhum dado foi perdido. Tente de novo; se o problema
        continuar, recarregue a página.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700"
        >
          Tentar de novo
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-navy/40"
        >
          Recarregar a página
        </button>
      </div>
      {digest && <p className="mt-4 font-mono text-xs text-muted">Código: {digest}</p>}
    </div>
  );
}
