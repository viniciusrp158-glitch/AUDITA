import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Alert } from "@/components/form";
import { ButtonLink, Card, CodeBadge, DefinitionList, StatusBadge, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatCep, formatCnae, formatCnpj, formatPhone, formatTaxId } from "@/lib/br";
import { ACTION_LABELS, describeChange, ENTITY_LABELS } from "@/lib/clients/labels";
import { getClientChildren, getClientHistory, getClientOr404 } from "@/lib/clients/queries";
import { formatDate, formatDateTime, formatDay, todaySaoPaulo } from "@/lib/format";
import { listDemands } from "@/lib/demands/queries";
import { DemandStatusPill, isOverdue, OverdueBadge } from "@/components/demand-status";
import {
  saveContactAction,
  saveUnitAction,
  setClientStatusAction,
  setContactStatusAction,
  setUnitStatusAction,
} from "../actions";
import { ClientStatusForm, ContactForm, UnitForm } from "./child-forms";

const TABS = [
  { id: "dados", label: "Dados" },
  { id: "unidades", label: "Unidades" },
  { id: "contatos", label: "Contatos" },
  { id: "relacionamento", label: "Demandas e propostas" },
  { id: "historico", label: "Histórico" },
] as const;

function address(a: {
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
}) {
  const line1 = [a.address_street, a.address_number].filter(Boolean).join(", ");
  const line2 = [a.address_complement, a.address_district].filter(Boolean).join(" · ");
  const line3 = [a.address_city && `${a.address_city}${a.address_state ? `/${a.address_state}` : ""}`, a.address_zip && `CEP ${formatCep(a.address_zip)}`]
    .filter(Boolean)
    .join(" · ");
  const parts = [line1, line2, line3].filter(Boolean);
  return parts.length ? parts.join(" — ") : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClientOr404(id);
  return { title: `${c.client_code} · ${c.legal_name}` };
}

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; criado?: string; salvo?: string; editar?: string; novo?: string }>;
}) {
  await requireAppUser(OPERATE);
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.aba) ? sp.aba! : "dados";
  const client = await getClientOr404(id);
  const { units, contacts } = await getClientChildren(id);
  const history = tab === "historico" ? await getClientHistory(id) : [];
  const demands = tab === "relacionamento" ? (await listDemands({ clientId: id, grupo: "todas", page: 1 })).rows : [];
  const today = todaySaoPaulo();
  const base = `/clientes/${id}`;
  const unitNames = Object.fromEntries(units.map((u) => [u.id, u.name]));

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Clientes
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CodeBadge code={client.client_code} />
            <StatusBadge status={client.status} />
            {client.is_test && <TestBadge />}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{client.legal_name}</h1>
          {client.trade_name && <p className="text-sm text-muted">{client.trade_name}</p>}
        </div>
        <ButtonLink href={`${base}/editar`} variant="secondary">
          <Pencil size={15} /> Editar
        </ButtonLink>
      </header>

      {sp.criado && (
        <div className="mb-4">
          <Alert kind="info">
            Cliente cadastrado com o código <strong>{client.client_code}</strong>. Este código é permanente.
          </Alert>
        </div>
      )}
      {sp.salvo && !sp.criado && (
        <div className="mb-4">
          <Alert kind="info">Alterações salvas.</Alert>
        </div>
      )}
      {client.status === "inativo" && (
        <div className="mb-4">
          <Alert kind="warning">
            Cliente inativo desde {client.inactivated_at ? formatDate(client.inactivated_at) : "—"}. Motivo:{" "}
            {client.inactivation_reason}
          </Alert>
        </div>
      )}

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções do cliente">
        {TABS.map((t) => {
          const active = t.id === tab;
          const count = t.id === "unidades" ? units.length : t.id === "contatos" ? contacts.length : null;
          return (
            <Link
              key={t.id}
              href={`${base}?aba=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                active ? "border-green font-semibold text-navy" : "border-transparent text-muted hover:text-navy"
              }`}
            >
              {t.label}
              {count !== null && <span className="ml-1.5 rounded-full bg-surface px-1.5 text-xs text-muted">{count}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "dados" && (
        <div className="space-y-5">
          <Card title="Dados cadastrais">
            <DefinitionList
              items={[
                { label: "Tipo", value: client.person_type === "PJ" ? "Pessoa jurídica" : "Pessoa física" },
                { label: client.person_type === "PJ" ? "CNPJ" : "CPF", value: formatTaxId(client.tax_id) || "Não informado" },
                { label: "CNAE", value: formatCnae(client.cnae) },
                { label: "Segmento", value: client.segment },
                { label: "E-mail", value: client.email },
                { label: "Telefone", value: formatPhone(client.phone) },
                { label: "Endereço da sede", value: address(client) },
                { label: "Cadastrado em", value: formatDateTime(client.created_at) },
                { label: "Última alteração", value: formatDateTime(client.updated_at) },
              ]}
            />
            {client.notes && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{client.notes}</p>
              </div>
            )}
          </Card>
          <Card title={client.status === "ativo" ? "Inativar cliente" : "Reativar cliente"}>
            <ClientStatusForm action={setClientStatusAction.bind(null, client.id)} status={client.status} />
          </Card>
        </div>
      )}

      {tab === "unidades" && (
        <div className="space-y-5">
          {sp.salvo && <Alert kind="info">Unidade salva.</Alert>}
          {(sp.novo || sp.editar) && (
            <Card title={sp.editar ? "Editar unidade" : "Nova unidade"}>
              <UnitForm
                action={saveUnitAction.bind(null, client.id, sp.editar ?? null)}
                unit={units.find((u) => u.id === sp.editar)}
                cancelHref={`${base}?aba=unidades`}
              />
            </Card>
          )}
          <Card
            title="Unidades"
            actions={
              !sp.novo && !sp.editar ? (
                <Link href={`${base}?aba=unidades&novo=1`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
                  <Plus size={15} /> Nova unidade
                </Link>
              ) : null
            }
          >
            {units.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma unidade cadastrada. A sede está nos dados do cliente.</p>
            ) : (
              <ul className="divide-y divide-line">
                {units.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        {u.name} <StatusBadge status={u.status} />
                      </p>
                      <p className="text-xs text-muted">
                        {[u.tax_id && `CNPJ ${formatCnpj(u.tax_id)}`, address(u), u.local_contact && `Contato local: ${u.local_contact}`]
                          .filter(Boolean)
                          .join(" · ") || "Sem endereço informado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Link href={`${base}?aba=unidades&editar=${u.id}`} className="text-navy hover:underline">
                        Editar
                      </Link>
                      <form action={setUnitStatusAction.bind(null, client.id, u.id, u.status === "ativo" ? "inativo" : "ativo")}>
                        <button type="submit" className="text-muted hover:text-navy">
                          {u.status === "ativo" ? "Inativar" : "Reativar"}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "contatos" && (
        <div className="space-y-5">
          {sp.salvo && <Alert kind="info">Contato salvo.</Alert>}
          {(sp.novo || sp.editar) && (
            <Card title={sp.editar ? "Editar contato" : "Novo contato"}>
              <ContactForm
                action={saveContactAction.bind(null, client.id, sp.editar ?? null)}
                contact={contacts.find((c) => c.id === sp.editar)}
                units={units}
                cancelHref={`${base}?aba=contatos`}
              />
            </Card>
          )}
          <Card
            title="Contatos e responsáveis"
            actions={
              !sp.novo && !sp.editar ? (
                <Link href={`${base}?aba=contatos&novo=1`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
                  <Plus size={15} /> Novo contato
                </Link>
              ) : null
            }
          >
            {contacts.length === 0 ? (
              <p className="text-sm text-muted">Nenhum contato cadastrado.</p>
            ) : (
              <ul className="divide-y divide-line">
                {contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {c.full_name}
                        {c.is_primary && (
                          <span className="rounded-full bg-green/15 px-2 py-0.5 text-xs font-semibold text-green-dark">Principal</span>
                        )}
                        <StatusBadge status={c.status} />
                      </p>
                      <p className="text-xs text-muted">
                        {[
                          c.role_title,
                          c.email,
                          formatPhone(c.phone),
                          c.unit_id ? `Unidade: ${units.find((u) => u.id === c.unit_id)?.name ?? "—"}` : "Cliente (geral)",
                          c.purpose,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Link href={`${base}?aba=contatos&editar=${c.id}`} className="text-navy hover:underline">
                        Editar
                      </Link>
                      <form action={setContactStatusAction.bind(null, client.id, c.id, c.status === "ativo" ? "inativo" : "ativo")}>
                        <button type="submit" className="text-muted hover:text-navy">
                          {c.status === "ativo" ? "Inativar" : "Reativar"}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "relacionamento" && (
        <Card
          title="Demandas"
          actions={
            client.status === "ativo" ? (
              <Link href={`/demandas/nova?cliente=${client.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
                <Plus size={15} /> Nova demanda
              </Link>
            ) : null
          }
        >
          {demands.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma demanda registrada para este cliente.</p>
          ) : (
            <ul className="divide-y divide-line">
              {demands.map((d) => (
                <li key={d.id} className="py-2.5">
                  <Link href={`/demandas/${d.id}`} className="block hover:text-navy">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-navy">{d.demand_code}</span>
                      <DemandStatusPill status={d.status} />
                      {isOverdue(d, today) && <OverdueBadge />}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink">{d.summary}</span>
                    <span className="block text-xs text-muted">
                      Recebida {formatDay(d.received_on)}
                      {d.services ? ` · ${d.services.service_code}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Propostas e serviços contratados aparecerão aqui a partir do I6.</p>
        </Card>
      )}

      {tab === "historico" && (
        <Card title="Histórico de alterações">
          {history.length === 0 ? (
            <p className="text-sm text-muted">Nenhum registro.</p>
          ) : (
            <ol className="space-y-4">
              {history.map((h) => {
                const lines = describeChange(h.action, h.summary ?? {}, { unitNames });
                return (
                  <li key={h.id} className="border-l-2 border-line pl-4">
                    <p className="text-sm">
                      <span className="font-medium text-ink">
                        {ACTION_LABELS[h.action] ?? h.action} · {ENTITY_LABELS[h.entity] ?? h.entity}
                      </span>{" "}
                      <span className="text-xs tabular-nums text-muted">{formatDateTime(h.occurred_at)}</span>
                    </p>
                    {lines.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-muted">
                        {lines.slice(0, 12).map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}
    </>
  );
}
