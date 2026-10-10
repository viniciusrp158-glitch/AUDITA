import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatCep, formatCnpj, formatPhone } from "@/lib/br";
import { REQUEST_STATUS } from "@/lib/clients/labels";
import { isProduction } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ClientForm, type ClientFormValues } from "../../client-form";
import { approveRequestAction, rejectRequestAction } from "../actions";
import { RejectForm } from "./reject-form";

export const metadata = { title: "Analisar solicitação" };

type Unit = {
  name: string;
  tax_id: string | null;
  address_street: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  local_contact: string | null;
};
type Contact = {
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  purpose: string | null;
  is_primary: boolean;
  unit_index: number | null;
};
type Req = {
  id: string;
  status: string;
  submitted_at: string;
  terms_version: string;
  terms_accepted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  client_id: string | null;
  payload: { client: ClientFormValues; units?: Unit[]; contacts?: Contact[] };
  client_invites: { recipient: string; is_test: boolean } | null;
  clients: { client_code: string } | null;
};

export default async function SolicitacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ recusada?: string }>;
}) {
  await requireAppUser(ADMIN_ONLY);
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_registration_requests")
    .select("id, status, submitted_at, terms_version, terms_accepted_at, reviewed_at, review_note, client_id, payload, client_invites(recipient, is_test), clients(client_code)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const req = data as unknown as Req;
  const units = req.payload.units ?? [];
  const contacts = req.payload.contacts ?? [];
  const st = REQUEST_STATUS[req.status];

  return (
    <>
      <Link href="/clientes/solicitacoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Solicitações
      </Link>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st?.cls}`}>{st?.label}</span>
          {req.client_invites?.is_test && <TestBadge />}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{req.payload.client.legal_name}</h1>
        <p className="text-sm text-muted">
          Link enviado para {req.client_invites?.recipient ?? "—"} · recebida em {formatDateTime(req.submitted_at)} · termo{" "}
          {req.terms_version} aceito em {formatDateTime(req.terms_accepted_at)}
        </p>
      </header>

      {sp.recusada && (
        <div className="mb-4">
          <Alert kind="info">Solicitação recusada. Nenhum cadastro foi criado.</Alert>
        </div>
      )}
      {req.status === "aprovada" && req.client_id && (
        <div className="mb-4">
          <Alert kind="info">
            Aprovada em {req.reviewed_at ? formatDateTime(req.reviewed_at) : "—"}. Cliente criado:{" "}
            <Link href={`/clientes/${req.client_id}`} className="font-semibold underline">
              {req.clients?.client_code}
            </Link>
          </Alert>
        </div>
      )}
      {req.status === "recusada" && !sp.recusada && (
        <div className="mb-4">
          <Alert kind="warning">
            Recusada em {req.reviewed_at ? formatDateTime(req.reviewed_at) : "—"}. Motivo: {req.review_note}
          </Alert>
        </div>
      )}

      <div className="space-y-5">
        <Card title={`Unidades informadas (${units.length})`}>
          {units.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma unidade adicional.</p>
          ) : (
            <ul className="divide-y divide-line">
              {units.map((u, i) => (
                <li key={i} className="py-2 text-sm">
                  <p className="font-medium text-ink">
                    Unidade {i + 1}: {u.name}
                  </p>
                  <p className="text-xs text-muted">
                    {[u.tax_id && `CNPJ ${formatCnpj(u.tax_id)}`, u.address_street, u.address_district, u.address_city && `${u.address_city}${u.address_state ? `/${u.address_state}` : ""}`, u.address_zip && `CEP ${formatCep(u.address_zip)}`, u.local_contact && `Contato local: ${u.local_contact}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Contatos informados (${contacts.length})`}>
          <ul className="divide-y divide-line">
            {contacts.map((c, i) => (
              <li key={i} className="py-2 text-sm">
                <p className="font-medium text-ink">
                  {c.full_name}
                  {c.is_primary && <span className="ml-2 rounded-full bg-green/15 px-2 py-0.5 text-xs font-semibold text-green-dark">Principal</span>}
                </p>
                <p className="text-xs text-muted">
                  {[c.role_title, c.email, formatPhone(c.phone), c.unit_index !== null && c.unit_index !== undefined ? `Unidade ${c.unit_index + 1}` : "Sede / geral", c.purpose]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        {req.status === "pendente" ? (
          <>
            <Card title="Conferir dados da empresa e aprovar">
              <p className="mb-4 text-sm text-muted">
                Os dados abaixo vieram do cliente e podem ser corrigidos antes da aprovação. O envio original fica preservado. Ao
                aprovar, o cliente recebe o código CLI e as unidades e contatos acima são criados.
              </p>
              {!isProduction && (
                <div className="mb-4">
                  <DefinitionList items={[{ label: "Ambiente", value: "Desenvolvimento — o cliente será marcado como TESTE" }]} />
                </div>
              )}
              <ClientForm
                action={approveRequestAction.bind(null, req.id)}
                initial={req.payload.client}
                submitLabel="Aprovar e cadastrar cliente"
                cancelHref="/clientes/solicitacoes"
                isDev={false}
              />
            </Card>
            <Card title="Recusar solicitação">
              <RejectForm action={rejectRequestAction.bind(null, req.id)} />
            </Card>
          </>
        ) : (
          <Card title="Dados enviados pelo cliente">
            <DefinitionList
              items={[
                { label: "Razão social / nome", value: req.payload.client.legal_name },
                { label: "Nome fantasia", value: req.payload.client.trade_name },
                { label: "CNPJ/CPF", value: req.payload.client.tax_id },
                { label: "Município/UF", value: [req.payload.client.address_city, req.payload.client.address_state].filter(Boolean).join("/") },
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}
