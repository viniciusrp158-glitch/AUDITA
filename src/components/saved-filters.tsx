"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, X } from "lucide-react";

/**
 * Filtros salvos (Frente A, A11): guarda combinações de filtros da lista com um nome, NESTE aparelho (navegador),
 * para reabrir com um toque. Não vai para o servidor; até 8 por lista.
 */
type Saved = { name: string; qs: string };
const MAX = 8;
/** Parâmetros que não fazem parte do filtro (página, avisos). */
const IGNORE = ["p", "ok", "salvo", "criado"];

export function SavedFilters({ listKey }: { listKey: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const key = `audita:filtros:${listKey}`;
  const [items, setItems] = useState<Saved[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(key) ?? "[]") as Saved[]);
    } catch {
      setItems([]);
    }
  }, [key]);

  const params = new URLSearchParams([...sp.entries()].filter(([k, v]) => !IGNORE.includes(k) && v !== ""));
  params.sort();
  const current = params.toString();
  const persist = (next: Saved[]) => {
    setItems(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* armazenamento indisponível: o filtro fica só até sair da página */
    }
  };
  const save = () => {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    persist([{ name: n, qs: current }, ...items.filter((i) => i.name !== n && i.qs !== current)].slice(0, MAX));
    setName("");
    setNaming(false);
  };

  if (!items.length && !current) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Filtros salvos" role="group">
      <Bookmark size={14} className="text-muted" aria-hidden />
      {items.map((i) => (
        <span key={i.name} className={`inline-flex items-center rounded-full border text-xs ${i.qs === current ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>
          <Link href={`${pathname}${i.qs ? `?${i.qs}` : ""}`} className="py-1 pl-3 pr-1.5 font-medium" aria-current={i.qs === current ? "true" : undefined}>
            {i.name}
          </Link>
          <button
            type="button"
            onClick={() => persist(items.filter((x) => x.name !== i.name))}
            className="rounded-full p-1 pr-2 opacity-70 hover:opacity-100"
            aria-label={`Remover o filtro salvo ${i.name}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {current && !items.some((i) => i.qs === current) &&
        (naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="inline-flex items-center gap-1"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Nome do filtro"
              aria-label="Nome do filtro"
              className="w-36 rounded-md border border-line bg-white px-2 py-1 text-xs outline-none focus:border-navy"
            />
            <button type="submit" className="rounded-md bg-navy px-2 py-1 text-xs font-semibold text-white">
              Salvar
            </button>
            <button type="button" onClick={() => setNaming(false)} className="px-1 text-xs text-muted">
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setNaming(true)} className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted hover:text-navy">
            + Salvar este filtro
          </button>
        ))}
    </div>
  );
}
