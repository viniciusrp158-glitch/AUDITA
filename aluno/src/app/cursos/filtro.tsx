"use client";

import { Children, isValidElement, useMemo, useState } from "react";
import { Search } from "lucide-react";

type Item = { codigo: string; nome: string; area: string | null; node: React.ReactNode };

/**
 * Busca e filtro por área do catálogo. Os cartões chegam prontos do servidor (cada filho com `data-busca` e
 * `data-area`); aqui só se esconde o que não combina.
 */
export function FiltroCursos({ children }: { children: React.ReactNode }) {
  const itens: Item[] = useMemo(
    () =>
      Children.toArray(children)
        .filter(isValidElement)
        .map((el, idx) => {
          const p = el.props as { "data-busca"?: string; "data-area"?: string | null };
          return { codigo: String(el.key ?? idx), nome: (p["data-busca"] ?? "").toLowerCase(), area: p["data-area"] ?? null, node: el };
        }),
    [children],
  );
  const areas = Array.from(new Set(itens.map((i) => i.area).filter(Boolean))) as string[];
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const q = busca.trim().toLowerCase();
  const visiveis = itens.filter((i) => (!area || i.area === area) && (!q || i.nome.includes(q)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-0 flex-[2_1_260px] flex-col gap-1.5 text-sm font-medium text-ink">
          Buscar curso
          <span className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o nome ou o tema"
              className="min-h-12 w-full rounded-[10px] border-[1.5px] border-line bg-white pr-3.5 pl-10 text-base outline-none focus:border-green-dark focus:ring-2 focus:ring-green/25"
            />
          </span>
        </label>
        {areas.length > 1 && (
          <div className="flex flex-[3_1_300px] flex-wrap gap-2" role="group" aria-label="Área">
            {[null, ...areas].map((a) => (
              <button
                key={a ?? "todas"}
                type="button"
                onClick={() => setArea(a)}
                aria-pressed={area === a}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${area === a ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy"}`}
              >
                {a ?? "Todas"}
              </button>
            ))}
          </div>
        )}
      </div>
      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">Nenhum curso encontrado com essa busca.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="store-list">
          {visiveis.map((i) => i.node)}
        </ul>
      )}
    </div>
  );
}
