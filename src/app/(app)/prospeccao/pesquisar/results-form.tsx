"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/form";
import { formatCnae } from "@/lib/br";
import { BAND_LABEL, type ScoreBand } from "@/lib/prospect/score";
import { addLeadsAction, type ProspectState } from "../actions";

export type ResultRow = {
  cnpj: string;
  name: string;
  legalName: string;
  cnae: string;
  municipality: string;
  km: number | null;
  size: string;
  hasPhone: boolean;
  hasEmail: boolean;
  score: number;
  band: ScoreBand;
  known: "lead" | "cliente" | "nao_contatar" | null;
};

const KNOWN = { lead: "Já no funil", cliente: "Já é cliente", nao_contatar: "Não contatar" } as const;
const tone = (s: number) => (s >= 80 ? "bg-ok/10 text-ok" : s >= 65 ? "bg-blue/10 text-navy" : "bg-surface text-muted");

export function ResultsForm({ rows }: { rows: ResultRow[] }) {
  const [state, action, pending] = useActionState<ProspectState, FormData>(addLeadsAction, {});
  const selectable = rows.filter((r) => !r.known);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (c: string) => setPicked((p) => (p.has(c) ? new Set([...p].filter((x) => x !== c)) : new Set([...p, c])));
  const allOn = selectable.length > 0 && selectable.every((r) => picked.has(r.cnpj));

  if (!rows.length) return <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-muted">Nenhuma empresa com esses filtros.</p>;

  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas desta página"
                  checked={allOn}
                  onChange={() => setPicked(allOn ? new Set() : new Set(selectable.map((r) => r.cnpj)))}
                  className="size-4"
                />
              </th>
              <th className="px-3 py-2.5 font-semibold">Nota</th>
              <th className="px-3 py-2.5 font-semibold">Empresa</th>
              <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Município</th>
              <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Porte</th>
              <th className="px-3 py-2.5 font-semibold">Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.cnpj} className={r.known ? "bg-surface/50" : "hover:bg-surface/60"}>
                <td className="px-3 py-2.5">
                  {r.known ? null : (
                    <input type="checkbox" name="cnpj" value={r.cnpj} checked={picked.has(r.cnpj)} onChange={() => toggle(r.cnpj)} aria-label={`Selecionar ${r.name}`} className="size-4" />
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center font-bold tabular-nums ${tone(r.score)}`} title={BAND_LABEL[r.band]}>
                    {r.score}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-ink">{r.name}</span>
                  {r.name !== r.legalName && <span className="block text-xs text-muted">{r.legalName}</span>}
                  <span className="block text-xs text-muted">CNAE {formatCnae(r.cnae)}</span>
                  <span className="block text-xs text-muted md:hidden">
                    {r.municipality} · {r.size}
                  </span>
                  {r.known && <span className="mt-1 inline-block rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">{KNOWN[r.known]}</span>}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted md:table-cell">
                  {r.municipality}
                  <span className="block text-xs">{r.km === null ? "—" : `${Math.round(r.km)} km`}</span>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted md:table-cell">{r.size}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                  {r.hasPhone && r.hasEmail ? "Tel. e e-mail" : r.hasPhone ? "Telefone" : r.hasEmail ? "E-mail" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy px-4 py-3 text-white shadow-lg">
        <span className="text-sm">
          <strong>{picked.size}</strong> {picked.size === 1 ? "selecionada" : "selecionadas"} · entram como &quot;Lead importado&quot;, já com a nota
        </span>
        <button
          type="submit"
          disabled={!picked.size || pending}
          className="rounded-md bg-white px-4 py-2 text-sm font-bold text-navy transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar ao funil"}
        </button>
      </div>
    </form>
  );
}
