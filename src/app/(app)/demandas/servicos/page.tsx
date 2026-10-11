import Link from "next/link";
import { PageHeader } from "@/components/page";
import { TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { CONTRACT_STATUS, CONTRACT_STATUS_KEYS } from "@/lib/execucao/labels";
import { listContracts } from "@/lib/execucao/queries";
import { formatDay } from "@/lib/format";
import { ADMIN_ONLY } from "@/lib/permissions";
import { ContractStatusPill, DemandTabs } from "./shared";

export const metadata = { title: "Serviços contratados" };

export default async function ServicosPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const status = (CONTRACT_STATUS_KEYS as string[]).includes(sp.situacao ?? "") ? sp.situacao! : "";
  const list = await listContracts(status || undefined);
  return (
    <>
      <PageHeader
        title="Demandas"
        description="Serviços contratados (AUDDOC017 RF-07): execução, entregas, OS comercial, alterações de escopo e documentos de formalização, a partir da proposta aceita."
      />
      <DemandTabs active="servicos" showServices />
      <nav aria-label="Filtrar por situação" className="mb-4 flex flex-wrap gap-2">
        {[{ value: "", label: "Todos" }, ...CONTRACT_STATUS_KEYS.map((s) => ({ value: s, label: CONTRACT_STATUS[s].label }))].map((f) => (
          <Link
            key={f.value || "todos"}
            href={f.value ? `/demandas/servicos?situacao=${f.value}` : "/demandas/servicos"}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === f.value ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:border-navy/40"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
          Nenhum serviço contratado {status ? "nesta situação" : "ainda"}. O registro nasce na proposta aceita (Orçamentos → proposta → “Registrar serviço contratado”).
        </p>
      ) : (
        <ul className="space-y-3" data-testid="contracts-list">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/demandas/servicos/${c.id}`} className="block rounded-xl border border-line bg-white p-4 transition hover:border-navy/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-navy">{c.contract_code}</span>
                  <ContractStatusPill status={c.status} />
                  {c.is_test && <TestBadge />}
                </div>
                <p className="mt-1 break-words text-sm font-semibold text-ink">{c.clients?.legal_name ?? "—"}</p>
                <p className="mt-1 text-xs text-muted">
                  {c.quotes?.quote_code} · {c.demands?.demand_code} · {c.modality === "recorrente" ? "recorrente" : "pontual"}
                  {c.starts_on ? ` · início ${formatDay(c.starts_on)}` : ""}
                  {c.ends_on ? ` · término ${formatDay(c.ends_on)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
