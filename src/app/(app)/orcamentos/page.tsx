import { Suspense } from "react";
import { SavedFilters } from "@/components/saved-filters";
import Link from "next/link";
import { Search } from "lucide-react";
import { BOARD_CARD, Board, ExportLink, ViewToggle } from "@/components/board";
import { PageHeader } from "@/components/page";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/pricing/labels";
import { QuoteStatusPill } from "@/components/pricing-status";
import { TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { listQuotes, QUOTES_PAGE_SIZE } from "@/lib/pricing/queries";

export const metadata = { title: "Orçamentos" };

/** Quantos orçamentos o quadro carrega de uma vez. */
const BOARD_LIMIT = 500;

export default async function OrcamentosPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string; situacao?: string; visao?: string }> }) {
  await requireAppUser(OPERATE);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const situacao = sp.situacao && sp.situacao in QUOTE_STATUS ? (sp.situacao as QuoteStatus) : "";
  const page = Math.max(1, Number(sp.p) || 1);
  const board = sp.visao === "quadro";
  const { rows, total, error } = await listQuotes({ q, situacao, page: board ? 1 : page, size: board ? BOARD_LIMIT : QUOTES_PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / QUOTES_PAGE_SIZE));
  const filters = { ...(q && { q }), ...(situacao && { situacao }) };
  const qs = (p: number) => `?${new URLSearchParams({ ...filters, p: String(p) })}`;
  const listHref = `?${new URLSearchParams(filters)}`;
  const boardHref = `?${new URLSearchParams({ ...filters, visao: "quadro" })}`;
  const clientName = (r: (typeof rows)[number]) => r.clients?.trade_name || r.clients?.legal_name;
  const statusKeys = Object.keys(QUOTE_STATUS) as QuoteStatus[];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Orçamentos"
          description="Cotações calculadas pela metodologia AUDDOC011 (uma por demanda). Para iniciar, abra a demanda e use “Criar cotação”."
        />
        <ExportLink href={`/orcamentos/exportar${listHref}`} />
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        {board && <input type="hidden" name="visao" value="quadro" />}
        <label className="min-w-0 flex-1 basis-64">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Código (PROP-…, DEM-…), resumo ou cliente"
              className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </span>
        </label>
        <label className="min-w-0 flex-1 basis-44 sm:flex-none">
          <span className="sr-only">Situação</span>
          <select name="situacao" defaultValue={situacao} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
            <option value="">Qualquer situação</option>
            {statusKeys.map((k) => (
              <option key={k} value={k}>
                {QUOTE_STATUS[k].label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Filtrar
        </button>
        <span className="ml-auto">
          <ViewToggle board={board} listHref={listHref} boardHref={boardHref} />
        </span>
      </form>
      <Suspense>
        <SavedFilters listKey="orcamentos" />
      </Suspense>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível carregar os orçamentos.
        </p>
      ) : board ? (
        <>
          <Board
            columns={(situacao ? [situacao] : statusKeys).map((k) => ({
              key: k,
              label: QUOTE_STATUS[k].label,
              items: rows
                .filter((r) => r.status === k)
                .map((r) => ({
                  id: r.id,
                  node: (
                    <Link href={`/orcamentos/${r.id}`} className={BOARD_CARD}>
                      <span className="font-mono text-xs font-semibold text-navy">{r.quote_code}</span>
                      <span className="mt-0.5 block break-words text-sm font-semibold leading-snug text-ink">{r.demands?.summary}</span>
                      <span className="mt-1 block text-xs text-muted">{clientName(r)}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                        Atualizado {formatDateTime(r.updated_at)}
                        {r.is_test && <TestBadge />}
                      </span>
                    </Link>
                  ),
                })),
            }))}
          />
          {total > rows.length && (
            <p className="mt-2 text-xs text-muted">
              Mostrando {rows.length} de {total} orçamentos. Use a pesquisa ou a lista para ver os demais.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Demanda</th>
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Itens</th>
                  <th className="px-4 py-2.5 font-semibold">Atualizada</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-surface/60">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/orcamentos/${r.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                        {r.quote_code}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-muted">{r.demands?.demand_code}</span>
                      <span className="block text-ink">{r.demands?.summary}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      <span className="font-mono text-xs">{r.clients?.client_code}</span> {clientName(r)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{r.quote_items?.length ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatDateTime(r.updated_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1">
                        <QuoteStatusPill status={r.status} />
                        {r.is_test && <TestBadge />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/orcamentos/${r.id}`} className="block rounded-xl border border-line bg-white p-3 active:bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">{r.quote_code}</span>
                    <QuoteStatusPill status={r.status} />
                  </div>
                  <p className="mt-1 break-words text-sm font-medium text-ink">{r.demands?.summary}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.clients?.client_code} {clientName(r)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                    {r.quote_items?.length ?? 0} ite{(r.quote_items?.length ?? 0) === 1 ? "m" : "ns"} · {formatDateTime(r.updated_at)}
                    {r.is_test && <TestBadge />}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
              {q || situacao ? "Nenhum orçamento encontrado." :"Nenhum orçamento ainda. Crie a cotação a partir de uma demanda."}
            </p>
          )}

          <nav className="mt-4 flex items-center justify-between text-sm text-muted" aria-label="Paginação">
            <span>
              {total} orçamento{total === 1 ? "" : "s"} · página {page} de {pages}
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
