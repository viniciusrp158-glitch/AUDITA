import Link from "next/link";
import { Inbox, Link2, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { ButtonLink, CodeBadge, StatusBadge, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatTaxId } from "@/lib/br";
import { countPendingRequests, listClients, PAGE_SIZE } from "@/lib/clients/queries";

export const metadata = { title: "Clientes" };

const SITUACOES = [
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "todos", label: "Todos" },
];

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; situacao?: string; p?: string }>;
}) {
  await requireAppUser(OPERATE);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const situacao = SITUACOES.some((s) => s.value === sp.situacao) ? sp.situacao! : "ativos";
  const page = Math.max(1, Number(sp.p) || 1);
  const [{ rows, total, error }, pending] = await Promise.all([listClients({ q, situacao, page }), countPendingRequests()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q && { q }), situacao, p: String(p) })}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Clientes" description="Cadastro mestre de empresas, unidades e contatos. O código CLI é permanente." />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/clientes/solicitacoes" variant="secondary">
            <Inbox size={16} /> Solicitações
            {pending > 0 && <span className="rounded-full bg-warn px-1.5 text-xs font-bold text-white">{pending}</span>}
          </ButtonLink>
          <ButtonLink href="/clientes/convites" variant="secondary">
            <Link2 size={16} /> Link de cadastro
          </ButtonLink>
          <ButtonLink href="/clientes/novo">
            <Plus size={16} /> Novo cliente
          </ButtonLink>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <label className="min-w-64 flex-1">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Pesquisar por nome, código (CLI-0001) ou CNPJ/CPF"
              className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </span>
        </label>
        <label>
          <span className="sr-only">Situação</span>
          <select
            name="situacao"
            defaultValue={situacao}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
          >
            {SITUACOES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
          Não foi possível carregar os clientes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Código</th>
                <th className="px-4 py-2.5 font-semibold">Cliente</th>
                <th className="px-4 py-2.5 font-semibold">CNPJ/CPF</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Segmento</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Município</th>
                <th className="px-4 py-2.5 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface/60">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link href={`/clientes/${c.id}`} className="focus:outline-none">
                      <CodeBadge code={c.client_code} />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                      {c.legal_name}
                    </Link>
                    {c.trade_name && <span className="block text-xs text-muted">{c.trade_name}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatTaxId(c.tax_id) || "—"}</td>
                  <td className="hidden px-4 py-2.5 text-muted md:table-cell">{c.segment || "—"}</td>
                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted md:table-cell">
                    {c.address_city ? `${c.address_city}${c.address_state ? `/${c.address_state}` : ""}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={c.status} />
                      {c.is_test && <TestBadge />}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                    {q ? "Nenhum cliente encontrado para esta pesquisa." : "Nenhum cliente cadastrado ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <nav className="mt-4 flex items-center justify-between text-sm text-muted" aria-label="Paginação">
        <span>
          {total} cliente{total === 1 ? "" : "s"} · página {page} de {pages}
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
  );
}
