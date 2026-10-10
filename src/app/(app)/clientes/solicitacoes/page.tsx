import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatTaxId } from "@/lib/br";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_STATUS } from "@/lib/clients/labels";

export const metadata = { title: "Solicitações de cadastro" };

const FILTERS = [
  { value: "pendente", label: "Pendentes" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "recusada", label: "Recusadas" },
];

type Row = {
  id: string;
  status: string;
  submitted_at: string;
  payload: { client?: { legal_name?: string; trade_name?: string | null; tax_id?: string | null; address_city?: string | null; address_state?: string | null } };
  client_invites: { recipient: string } | null;
};

export default async function SolicitacoesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAppUser(OPERATE);
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.value === sp.status) ? sp.status! : "pendente";
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_registration_requests")
    .select("id, status, submitted_at, payload, client_invites(recipient)")
    .eq("status", status)
    .order("submitted_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Clientes
      </Link>
      <PageHeader title="Solicitações de cadastro" description="Dados enviados pelos clientes por link. Nada vira cadastro sem sua aprovação." />
      <nav className="mb-4 flex gap-1 border-b border-line" aria-label="Filtro de situação">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`?status=${f.value}`}
            aria-current={f.value === status ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${f.value === status ? "border-green font-semibold text-navy" : "border-transparent text-muted hover:text-navy"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Empresa informada</th>
              <th className="px-4 py-2.5 font-semibold">CNPJ/CPF</th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Link enviado para</th>
              <th className="px-4 py-2.5 font-semibold">Recebida em</th>
              <th className="px-4 py-2.5 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface/60">
                <td className="px-4 py-2.5">
                  <Link href={`/clientes/solicitacoes/${r.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                    {r.payload.client?.legal_name ?? "—"}
                  </Link>
                  {r.payload.client?.address_city && (
                    <span className="block text-xs text-muted">
                      {r.payload.client.address_city}/{r.payload.client.address_state}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatTaxId(r.payload.client?.tax_id) || "—"}</td>
                <td className="hidden px-4 py-2.5 text-muted md:table-cell">{r.client_invites?.recipient ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatDateTime(r.submitted_at)}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REQUEST_STATUS[r.status]?.cls}`}>{REQUEST_STATUS[r.status]?.label}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                  Nenhuma solicitação nesta situação.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
