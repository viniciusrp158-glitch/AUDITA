import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { inviteStatus, type InviteStatus } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { cancelInviteAction } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Links de cadastro" };

const STATUS: Record<InviteStatus, { label: string; cls: string }> = {
  enviado: { label: "Enviado", cls: "bg-blue/10 text-navy" },
  preenchido: { label: "Preenchido", cls: "bg-ok/10 text-ok" },
  expirado: { label: "Expirado", cls: "bg-surface text-muted" },
  cancelado: { label: "Cancelado", cls: "bg-surface text-muted" },
};

type Row = {
  id: string;
  recipient: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  cancelled_at: string | null;
  is_test: boolean;
  client_registration_requests: { id: string; status: string }[] | { id: string; status: string } | null;
};

export default async function ConvitesPage() {
  await requireAppUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_invites")
    .select("id, recipient, note, created_at, expires_at, used_at, cancelled_at, is_test, client_registration_requests(id, status)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];
  const now = Date.now();

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Clientes
      </Link>
      <PageHeader
        title="Links de cadastro"
        description="Gere um link individual para o cliente preencher os próprios dados. Cada link vale por 24 horas e para um único envio; o cadastro só é criado após sua aprovação."
      />
      <div className="space-y-5">
        <Card title="Novo link">
          <InviteForm />
        </Card>
        <Card title="Links enviados">
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Nenhum link gerado ainda.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const st = inviteStatus(r, now);
                const req = Array.isArray(r.client_registration_requests) ? r.client_registration_requests[0] : r.client_registration_requests;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {r.recipient}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[st].cls}`}>{STATUS[st].label}</span>
                        {r.is_test && <TestBadge />}
                      </p>
                      <p className="text-xs text-muted">
                        Gerado em {formatDateTime(r.created_at)}
                        {st === "enviado" && ` · expira em ${formatDateTime(r.expires_at)}`}
                        {st === "preenchido" && r.used_at && ` · preenchido em ${formatDateTime(r.used_at)}`}
                        {st === "expirado" && ` · expirou em ${formatDateTime(r.expires_at)}`}
                        {r.note ? ` · ${r.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {req && (
                        <Link href={`/clientes/solicitacoes/${req.id}`} className="font-semibold text-navy hover:underline">
                          {req.status === "pendente" ? "Analisar solicitação" : "Ver solicitação"}
                        </Link>
                      )}
                      {st === "enviado" && (
                        <form action={cancelInviteAction.bind(null, r.id)}>
                          <button type="submit" className="text-muted hover:text-danger">
                            Cancelar link
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
