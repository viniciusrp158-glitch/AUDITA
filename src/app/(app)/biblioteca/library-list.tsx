"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { LibStatusPill } from "@/components/library-status";
import type { LibRevStatus } from "@/lib/library/labels";

export type LibRow = {
  id: string;
  doc_code: string;
  title: string;
  family: string;
  parent_id: string | null;
  approved_on: string | null;
  revision: string | null;
  status: LibRevStatus | null;
  inactive: boolean;
};

function day(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Situation({ r }: { r: LibRow }) {
  if (!r.revision || !r.status) return <span className="text-xs text-muted">Sem arquivo</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-xs text-ink">{r.revision}</span>
      <LibStatusPill status={r.status} />
      {r.inactive && <span className="text-xs text-muted">(inativo)</span>}
    </span>
  );
}

/**
 * Lista da biblioteca com anexos recolhíveis: o documento principal mostra uma seta com a quantidade de anexos.
 * Recolhidos por padrão; abertos quando há pesquisa (para mostrar o que foi encontrado).
 */
export function LibraryList({ rows, expandAll }: { rows: LibRow[]; expandAll: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tops = rows.filter((d) => !d.parent_id || !rows.some((p) => p.id === d.parent_id));
  const annexesOf = (id: string) => rows.filter((a) => a.parent_id === id);
  const isOpen = (id: string) => open[id] ?? expandAll;
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !isOpen(id) }));

  function Toggle({ d, n }: { d: LibRow; n: number }) {
    if (!n) return null;
    const o = isOpen(d.id);
    return (
      <button
        type="button"
        onClick={() => toggle(d.id)}
        aria-expanded={o}
        aria-label={`${o ? "Recolher" : "Exibir"} ${n} anexo${n === 1 ? "" : "s"} de ${d.doc_code}`}
        data-testid={`toggle-${d.doc_code}`}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold text-navy hover:border-navy/40"
      >
        <ChevronDown size={14} className={`transition ${o ? "rotate-180" : ""}`} />
        {n} anexo{n === 1 ? "" : "s"}
      </button>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Código</th>
              <th className="px-4 py-2.5 font-semibold">Título</th>
              <th className="px-4 py-2.5 font-semibold">Família</th>
              <th className="px-4 py-2.5 font-semibold">Aprovação</th>
              <th className="px-4 py-2.5 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tops.map((d) => {
              const ax = annexesOf(d.id);
              return (
                <Fragment key={d.id}>
                  <tr className="align-top hover:bg-surface/60">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-navy">{d.doc_code}</span>
                        <Toggle d={d} n={ax.length} />
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/biblioteca/${d.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{d.family}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{day(d.approved_on)}</td>
                    <td className="px-4 py-2.5">
                      <Situation r={d} />
                    </td>
                  </tr>
                  {isOpen(d.id) &&
                    ax.map((a) => (
                      <tr key={a.id} className="bg-surface/40 align-top hover:bg-surface/70" data-testid="annex-row">
                        <td className="whitespace-nowrap py-2.5 pl-10 pr-4 font-mono text-xs font-semibold text-navy">{a.doc_code}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/biblioteca/${a.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                            {a.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted">{a.family}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{day(a.approved_on)}</td>
                        <td className="px-4 py-2.5">
                          <Situation r={a} />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {tops.map((d) => {
          const ax = annexesOf(d.id);
          return (
            <li key={d.id}>
              <div className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-navy">{d.doc_code}</span>
                  <Situation r={d} />
                </div>
                <Link href={`/biblioteca/${d.id}`} className="mt-1 block break-words text-sm font-medium text-ink active:text-navy">
                  {d.title}
                </Link>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted">{d.family}</p>
                  <Toggle d={d} n={ax.length} />
                </div>
              </div>
              {isOpen(d.id) && ax.length > 0 && (
                <ul className="mt-1 space-y-1 border-l-2 border-line pl-3">
                  {ax.map((a) => (
                    <li key={a.id}>
                      <Link href={`/biblioteca/${a.id}`} className="block rounded-lg border border-line bg-white p-2.5 active:bg-surface">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-navy">{a.doc_code}</span>
                          <Situation r={a} />
                        </div>
                        <p className="mt-0.5 break-words text-sm text-ink">{a.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
