import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { QuoteStatusPill } from "@/components/pricing-status";
import { TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listQuotes, QUOTES_PAGE_SIZE } from "@/lib/pricing/queries";

export const metadata = { title: "Orçamentos" };

export default async function OrcamentosPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  await requireAppUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const page = Math.max(1, Number(sp.p) || 1);
  const { rows, total, error } = await listQuotes({ q, page });
  const pages = Math.max(1, Math.ceil(total / QUOTES_PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q && { q }), p: String(p) })}`;
  const clientName = (r: (typeof rows)[number]) => r.clients?.trade_name || r.clients?.legal_name;

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Cotações calculadas pela metodologia AUDDOC011 (uma por demanda). Para iniciar, abra a demanda e use “Criar cotação”."
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
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
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Pesquisar
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível carregar os orçamentos.
        </p>
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
                    <td className="px-4 py-2.5 tabular-nums text-muted">{r.quote_items?.[0]?.count ?? 0}</td>
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
                    {r.quote_items?.[0]?.count ?? 0} ite{(r.quote_items?.[0]?.count ?? 0) === 1 ? "m" : "ns"} · {formatDateTime(r.updated_at)}
                    {r.is_test && <TestBadge />}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
              {q ? "Nenhum orçamento encontrado." : "Nenhum orçamento ainda. Crie a cotação a partir de uma demanda."}
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
