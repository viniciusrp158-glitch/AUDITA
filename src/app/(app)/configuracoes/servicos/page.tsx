import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { StatusPill } from "@/components/service-status";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { normalizeSearch } from "@/lib/clients/queries";
import { COMMERCIAL_STATUS, COMMERCIAL_STATUS_KEYS, type CommercialStatus } from "@/lib/services/labels";
import { catalogOrder, listServices } from "@/lib/services/queries";

export const metadata = { title: "Catálogo de serviços" };

function norm(s: string | null | undefined) {
  return normalizeSearch(s ?? "");
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; familia?: string; situacao?: string }>;
}) {
  await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const { rows: all, error } = await listServices();

  const families = [...new Set(all.map((r) => r.family))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const familia = families.includes(sp.familia ?? "") ? sp.familia! : "";
  const situacao = (COMMERCIAL_STATUS_KEYS as string[]).includes(sp.situacao ?? "") ? (sp.situacao as CommercialStatus) : "";
  const term = norm(q);

  const rows = catalogOrder(
    all.filter(
      (r) =>
        (!familia || r.family === familia) &&
        (!situacao || r.commercial_status === situacao) &&
        (!term || [r.service_code, r.name, r.norm, r.family].some((v) => norm(v).includes(term))),
    ),
  );

  const counts = Object.fromEntries(COMMERCIAL_STATUS_KEYS.map((k) => [k, all.filter((r) => r.commercial_status === k).length]));

  return (
    <>
      <Link href="/configuracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Configurações
      </Link>
      <PageHeader
        title="Catálogo de serviços"
        description="Serviços e ofertas da AUDDOC004/005 Rev.00. Somente serviços “Apto comercialmente” poderão gerar proposta comercial final."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COMMERCIAL_STATUS_KEYS.map((k) => (
          <Link
            key={k}
            href={situacao === k ? "?" : `?situacao=${k}`}
            aria-current={situacao === k ? "true" : undefined}
            className={`rounded-xl border bg-white px-4 py-3 transition hover:border-navy/40 ${situacao === k ? "border-navy" : "border-line"}`}
          >
            <p className="text-2xl font-semibold tabular-nums text-ink">{counts[k]}</p>
            <p className="text-xs text-muted">{COMMERCIAL_STATUS[k].label}</p>
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <label className="min-w-0 flex-1 basis-64">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Código, nome ou norma (ex.: NR-35)"
              className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </span>
        </label>
        <label className="min-w-0 flex-1 basis-40 sm:flex-none">
          <span className="sr-only">Família</span>
          <select name="familia" defaultValue={familia} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
            <option value="">Todas as famílias</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 basis-40 sm:flex-none">
          <span className="sr-only">Situação</span>
          <select name="situacao" defaultValue={situacao} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
            <option value="">Todas as situações</option>
            {COMMERCIAL_STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {COMMERCIAL_STATUS[k].label}
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
          Não foi possível carregar o catálogo.
        </p>
      ) : (
        <>
          {/* Computador: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Serviço / oferta</th>
                  <th className="px-4 py-2.5 font-semibold">Família</th>
                  <th className="px-4 py-2.5 font-semibold">Classe</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-navy">
                      {r.kind === "oferta" && <span aria-hidden className="mr-1 text-muted">↳</span>}
                      {r.service_code}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/configuracoes/servicos/${r.id}`} className="text-ink hover:text-navy hover:underline">
                        {r.name}
                      </Link>
                      {r.kind === "oferta" && <span className="block text-xs text-muted">Oferta de {r.parent_code}</span>}
                      {r.pricing_model === "sem_modelo_definido" && <span className="block text-xs text-muted">sem cálculo por hora técnica</span>}
                      {r.catalog_status === "inativo" && <span className="block text-xs font-semibold text-muted">Inativo no catálogo</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{r.family}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="rounded border border-line px-1.5 py-0.5 text-xs font-medium text-ink">Classe {r.matrix_class}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <StatusPill status={r.commercial_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/configuracoes/servicos/${r.id}`} className="block rounded-xl border border-line bg-white p-3 active:bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">
                      {r.kind === "oferta" && <span aria-hidden className="mr-1 text-muted">↳</span>}
                      {r.service_code}
                    </span>
                    <StatusPill status={r.commercial_status} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.family} · Classe {r.matrix_class}
                    {r.kind === "oferta" ? ` · Oferta de ${r.parent_code}` : ""}
                    {r.catalog_status === "inativo" ? " · Inativo no catálogo" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">Nenhum serviço encontrado.</p>
          )}
          <p className="mt-4 text-xs text-muted">
            {rows.length} de {all.length} itens · Fonte: AUDDOC004 Rev.00 (matriz e treinamentos por NR) e AUDDOC005 Rev.00.
          </p>
        </>
      )}
    </>
  );
}
