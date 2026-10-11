import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { DemandStatusPill, isOverdue, OverdueBadge, RecurringBadge } from "@/components/demand-status";
import { PageHeader } from "@/components/page";
import { ButtonLink, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { DEMAND_STATUS, DEMAND_STATUS_KEYS } from "@/lib/demands/labels";
import { listDemands, PAGE_SIZE } from "@/lib/demands/queries";
import { formatDay, todaySaoPaulo } from "@/lib/format";
import { DemandTabs } from "./servicos/shared";

export const metadata = { title: "Demandas" };

const GRUPOS = [
  { value: "abertas", label: "Em aberto" },
  { value: "encerradas", label: "Encerradas" },
  { value: "todas", label: "Todas" },
] as const;

export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grupo?: string; situacao?: string; p?: string }>;
}) {
  const user = await requireAppUser(OPERATE);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const grupo = (GRUPOS.find((g) => g.value === sp.grupo)?.value ?? "abertas") as "abertas" | "encerradas" | "todas";
  const situacao = (DEMAND_STATUS_KEYS as string[]).includes(sp.situacao ?? "") ? sp.situacao! : "";
  const page = Math.max(1, Number(sp.p) || 1);
  const { rows, total, error } = await listDemands({ q, grupo, situacao, page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = todaySaoPaulo();
  const qs = (p: number) => `?${new URLSearchParams({ ...(q && { q }), grupo, ...(situacao && { situacao }), p: String(p) })}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Demandas" description="Registro Único de Atendimento (AUDDOC009): solicitações, análise, acompanhamento e encerramento." />
        <ButtonLink href="/demandas/nova">
          <Plus size={16} /> Nova demanda
        </ButtonLink>
      </div>
      <DemandTabs active="demandas" showServices={user.role === "admin"} />

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filtro de situação">
        {GRUPOS.map((g) => (
          <Link
            key={g.value}
            href={`?${new URLSearchParams({ ...(q && { q }), grupo: g.value })}`}
            aria-current={g.value === grupo && !situacao ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${g.value === grupo && !situacao ? "border-green font-semibold text-navy" : "border-transparent text-muted hover:text-navy"}`}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="grupo" value={grupo} />
        <label className="min-w-0 flex-1 basis-64">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Código (DEM-…), resumo ou cliente"
              className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </span>
        </label>
        <label className="min-w-0 flex-1 basis-44 sm:flex-none">
          <span className="sr-only">Situação</span>
          <select name="situacao" defaultValue={situacao} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
            <option value="">Qualquer situação</option>
            {DEMAND_STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {DEMAND_STATUS[k].label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Filtrar
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível carregar as demandas.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Solicitação</th>
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Recebida</th>
                  <th className="px-4 py-2.5 font-semibold">Prazo</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((d) => (
                  <tr key={d.id} className="align-top hover:bg-surface/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-navy">{d.demand_code}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/demandas/${d.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                        {d.summary}
                      </Link>
                      {d.services && <span className="block text-xs text-muted">{d.services.service_code} — {d.services.name}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      <span className="font-mono text-xs">{d.clients?.client_code}</span> {d.clients?.trade_name || d.clients?.legal_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatDay(d.received_on)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatDay(d.due_on) || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1">
                        <DemandStatusPill status={d.status} />
                        {isOverdue(d, today) && <OverdueBadge />}
                        {d.is_recurring && <RecurringBadge />}
                        {d.is_test && <TestBadge />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((d) => (
              <li key={d.id}>
                <Link href={`/demandas/${d.id}`} className="block rounded-xl border border-line bg-white p-3 active:bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">{d.demand_code}</span>
                    <DemandStatusPill status={d.status} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{d.summary}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {d.clients?.client_code} {d.clients?.trade_name || d.clients?.legal_name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                    Recebida {formatDay(d.received_on)}
                    {d.due_on ? ` · prazo ${formatDay(d.due_on)}` : ""}
                    {isOverdue(d, today) && <OverdueBadge />}
                    {d.is_recurring && <RecurringBadge />}
                    {d.is_test && <TestBadge />}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
              {q || situacao ? "Nenhuma demanda encontrada." : "Nenhuma demanda nesta situação."}
            </p>
          )}

          <nav className="mt-4 flex items-center justify-between text-sm text-muted" aria-label="Paginação">
            <span>
              {total} demanda{total === 1 ? "" : "s"} · página {page} de {pages}
            </span>
            <span className="flex gap-3">
              {page > 1 && (
                <Link href={qs(page - 1)} className="text-navy hover:underline">
                  Anterior
                </Link>
              )}
              {page < pages && (
                <Link href={qs(page + 1)} className="text-navy hover:underline">
                  Próxima
                </Link>
              )}
            </span>
          </nav>
        </>
      )}
    </>
  );
}
