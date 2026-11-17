"use client";

/** Busca global (Frente A, A4): abre com Ctrl+K (⌘K no Mac), pelo campo do menu ou pela lupa do celular. */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/search/actions";

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // Atalho de teclado: só a instância do computador registra (as duas ficam montadas)
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  // Consulta com espera curta enquanto digita
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setDone("");
      return;
    }
    const t = setTimeout(
      () =>
        start(async () => {
          const r = await globalSearch(term);
          setHits(r);
          setSel(0);
          setDone(term);
        }),
      250,
    );
    return () => clearTimeout(t);
  }, [q]);

  const close = () => {
    setOpen(false);
    setQ("");
  };
  const go = (h: SearchHit) => {
    close();
    router.push(h.href);
  };

  const groups = [...new Set(hits.map((h) => h.group))];

  return (
    <>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="Buscar" className="rounded-md p-2.5 text-navy hover:bg-surface">
          <Search size={20} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-line bg-surface/40 px-3 py-2 text-left text-sm text-muted hover:border-navy/40"
        >
          <Search size={16} />
          <span className="flex-1">Buscar…</span>
          <kbd className="rounded border border-line bg-white px-1.5 text-[10px] font-semibold">Ctrl K</kbd>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-[8vh] sm:p-6 sm:pt-[12vh]" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Busca global"
            className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              {pending ? <Loader2 size={18} className="animate-spin text-muted" /> : <Search size={18} className="text-muted" />}
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSel((s) => Math.min(s + 1, hits.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSel((s) => Math.max(s - 1, 0));
                  } else if (e.key === "Enter" && hits[sel]) go(hits[sel]);
                }}
                maxLength={80}
                placeholder="Cliente, lead, demanda, orçamento, documento…"
                aria-label="Termo da busca"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-base text-ink outline-none sm:text-sm"
              />
              <button type="button" onClick={close} aria-label="Fechar busca" className="rounded-md p-2 text-muted hover:bg-surface">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2" role="listbox" aria-label="Resultados">
              {q.trim().length < 2 && <p className="px-3 py-6 text-center text-sm text-muted">Digite pelo menos 2 letras: nome, razão social, CNPJ ou código.</p>}
              {q.trim().length >= 2 && done === q.trim() && !hits.length && (
                <p className="px-3 py-6 text-center text-sm text-muted">Nada encontrado para &quot;{q.trim()}&quot;.</p>
              )}
              {groups.map((g) => (
                <div key={g} className="mb-2">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g}</p>
                  {hits.map((h, i) =>
                    h.group !== g ? null : (
                      <button
                        key={h.href}
                        type="button"
                        role="option"
                        aria-selected={i === sel}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => go(h)}
                        className={`block w-full rounded-md px-3 py-2.5 text-left ${i === sel ? "bg-navy text-white" : "text-ink hover:bg-surface"}`}
                      >
                        <span className="block truncate text-sm font-medium">{h.title}</span>
                        {h.detail && <span className={`block truncate text-xs ${i === sel ? "text-white/80" : "text-muted"}`}>{h.detail}</span>}
                      </button>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
