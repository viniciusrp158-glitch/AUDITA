import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Alert } from "@/components/form";
import { ButtonLink, Card, TestBadge } from "@/components/ui";
import { findClientByCnpj } from "@/lib/prospect/conversion";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { formatCep, formatCnae, formatPhone, formatTaxId } from "@/lib/br";
import { formatDateTime, formatDay } from "@/lib/format";
import { isMobile, KIND_LABEL, OUTCOME_LABEL, STAGE_LABEL, templateForNiche, type ActivityKind, type Outcome, type Stage } from "@/lib/prospect/labels";
import { getLead, getReleasedServices } from "@/lib/prospect/queries";
import { BAND_LABEL, SIZE_LABEL, type ScoreBand } from "@/lib/prospect/score";
import { ConfirmedContactForm, ContactPanel, LinkClientForm, StageForm, SuppressForm } from "./lead-forms";

export const metadata = { title: "Lead" };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidRe.test(id)) notFound();
  const [data, released] = await Promise.all([getLead(id), getReleasedServices()]);
  if (!data) notFound();
  const { lead, activities, history, company, suppressed, niche } = data;
  const name = lead.trade_name || lead.legal_name;

  // WhatsApp: confirmado > telefone confirmado (celular) > cadastro da Receita (celular), sempre dizendo a origem
  const rfbMobile = [company?.phone1, company?.phone2].find((p) => isMobile(p)) ?? null;
  const wa = lead.whatsapp_confirmed ?? (isMobile(lead.phone_confirmed) ? lead.phone_confirmed : null) ?? rfbMobile;
  const waSource = lead.whatsapp_confirmed
    ? "WhatsApp confirmado por você."
    : wa && wa === rfbMobile
      ? "Celular do cadastro da Receita: pode ser do contador. Confirme com a empresa e salve em \"Contato confirmado\"."
      : null;
  const phone = lead.phone_confirmed ?? company?.phone1 ?? company?.phone2 ?? null;
  const email = lead.email_confirmed ?? company?.email ?? null;
  const mapsQuery = encodeURIComponent([lead.legal_name, company?.street, company?.number, lead.municipality, "SP"].filter(Boolean).join(", "));
  const items = lead.score_detail?.items ?? [];
  const closed = lead.stage === "cliente" || lead.stage === "perdido";
  // RP-12: cliente vinculado ou, se ainda não, cliente que já existe com o mesmo CNPJ
  const supabase = await createClient();
  const linked = lead.client_id
    ? ((await supabase.from("clients").select("id, client_code, legal_name").eq("id", lead.client_id).maybeSingle()).data as { id: string; client_code: string; legal_name: string } | null)
    : null;
  const sameCnpj = lead.client_id ? null : await findClientByCnpj(lead.cnpj);

  const field = (label: string, value: string | null | undefined, tag?: string) => (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{value || <span className="text-muted">Não disponível</span>}</dd>
      {value && tag && <span className="text-[11px] font-semibold text-ok">{tag}</span>}
    </div>
  );
  const rfb = company ? `Receita ${company.publication.slice(5)}/${company.publication.slice(0, 4)}` : undefined;

  return (
    <>
      <Link href="/prospeccao/funil" className="text-sm font-semibold text-muted hover:text-navy">
        ← Funil
      </Link>
      <header className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-xl bg-surface text-xl font-bold tabular-nums text-ink">{lead.score ?? "—"}</span>
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {name} {lead.is_test && <TestBadge />}
            </h1>
            <p className="text-sm text-muted">
              {lead.score_band ? BAND_LABEL[lead.score_band as ScoreBand] : "Sem nota"} · {STAGE_LABEL[lead.stage as Stage]}
              {niche ? ` · ${niche.name}` : ""}
            </p>
          </div>
        </div>
        <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Ver no Google Maps <ExternalLink size={14} />
        </a>
      </header>

      {sp.ok === "nao-contatar" && <div className="mb-4"><Alert kind="info">Registrado em &quot;não contatar&quot;. A empresa saiu do funil.</Alert></div>}
      {lead.stage === "perdido" && lead.lost_reason && <div className="mb-4"><Alert kind="warning">Perdido ou desqualificado: {lead.lost_reason}</Alert></div>}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-5">
        <div className="contents lg:col-span-3 lg:block lg:space-y-6">
          <div className="order-1">
          <Card title="Contatar">
            <ContactPanel
              leadId={lead.id}
              company={name}
              sender={user.fullName.split(" ")[0]}
              defaultTemplate={templateForNiche(niche?.code)}
              whatsapp={wa}
              whatsappSource={waSource}
              phone={phone}
              email={email}
              blocked={suppressed || closed}
            />
          </Card>
          </div>

          <div className="order-6">
          <Card title={`Por que esta nota${lead.score !== null ? ` (${lead.score} de 100)` : ""}`}>
            {items.length ? (
              <ul className="space-y-2.5">
                {items.map((i) => (
                  <li key={i.key} className="grid grid-cols-[minmax(0,1fr)_6rem_3rem] items-center gap-3 text-sm">
                    <span>
                      <span className="font-medium text-ink">{i.label}</span>
                      <span className="block text-xs text-muted">{i.text}</span>
                    </span>
                    <span className="h-2 rounded-full bg-surface">
                      <span className="block h-2 rounded-full bg-navy" style={{ width: `${Math.round((i.points / i.max) * 100)}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums">
                      {i.points}/{i.max}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Sem qualificação registrada.</p>
            )}
            {lead.suggested_services.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-sm font-semibold text-ink">Serviços sugeridos</p>
                <p className="mb-2 text-xs text-muted">Hipóteses pelo segmento, não necessidades confirmadas. Só serviços liberados no catálogo.</p>
                <ul className="flex flex-wrap gap-2">
                  {lead.suggested_services.map((c) => (
                    <li key={c} className="rounded-md border border-line px-2 py-1 text-xs">
                      <strong className="font-mono">{c}</strong> {released.names.get(c) ?? ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          </div>

          <div className="order-7">
          <Card title="Dados cadastrais">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {field("Razão social", lead.legal_name, rfb)}
              {field("CNPJ", lead.cnpj ? formatTaxId(lead.cnpj) : null, rfb)}
              {field("CNAE principal", lead.cnae_main ? formatCnae(lead.cnae_main) : null, rfb)}
              {field("Porte", lead.size_code ? SIZE_LABEL[lead.size_code] : null, rfb)}
              {field("Início de atividade", company?.started_on ? formatDay(company.started_on) : null, rfb)}
              {field("Endereço", company ? [company.street, company.number, company.complement, company.district, `${lead.municipality ?? ""}/SP`, formatCep(company.zip)].filter(Boolean).join(", ") : null, rfb)}
              {field("Telefone (cadastro)", [company?.phone1, company?.phone2].filter(Boolean).map((p) => formatPhone(p)).join(" · ") || null, rfb)}
              {field("E-mail (cadastro)", company?.email, rfb)}
            </dl>
            <p className="mt-3 text-xs text-muted">Telefone e e-mail do cadastro da Receita costumam ser do contador que abriu a empresa. Confirme antes da abordagem.</p>
          </Card>
          </div>
        </div>

        <div className="contents lg:col-span-2 lg:block lg:space-y-6">
          <div className="order-2">
          <Card title="Cliente">
            {linked ? (
              <div className="space-y-3 text-sm">
                <p>
                  Vinculado ao cliente{" "}
                  <Link href={`/clientes/${linked.id}`} className="font-semibold text-navy hover:underline">
                    {linked.client_code} — {linked.legal_name}
                  </Link>
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/demandas/nova?cliente=${linked.id}`}>Abrir demanda</ButtonLink>
                  <ButtonLink href={`/clientes/${linked.id}?aba=relacionamento`} variant="secondary">
                    Demandas e propostas
                  </ButtonLink>
                </div>
                <p className="text-xs text-muted">
                  O orçamento sai da demanda, pelo fluxo de sempre. A etapa muda sozinha: proposta emitida → &quot;Proposta enviada&quot;;
                  proposta aceita → &quot;Cliente conquistado&quot;.
                </p>
              </div>
            ) : sameCnpj ? (
              <div className="space-y-3 text-sm">
                <p>
                  Esta empresa já é cliente:{" "}
                  <Link href={`/clientes/${sameCnpj.id}`} className="font-semibold text-navy hover:underline">
                    {sameCnpj.client_code} — {sameCnpj.legal_name}
                  </Link>{" "}
                  (mesmo CNPJ).
                </p>
                <LinkClientForm leadId={lead.id} clientId={sameCnpj.id} label="Vincular a este cliente" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted">
                  Quando a empresa quiser uma proposta, cadastre-a como cliente: o formulário vem preenchido com os dados do lead e
                  da Receita, e o sistema confere pelo CNPJ se ela já está cadastrada.
                </p>
                {suppressed ? (
                  <p className="text-xs text-muted">Empresa na lista &quot;não contatar&quot;.</p>
                ) : (
                  <ButtonLink href={`/clientes/novo?lead=${lead.id}`}>Converter em cliente</ButtonLink>
                )}
              </div>
            )}
          </Card>
          </div>
          <div className="order-3">
          {!closed && (
            <Card title="Etapa">
              <StageForm leadId={lead.id} stage={lead.stage} />
            </Card>
          )}
          </div>
          <div className="order-4">
          <Card title="Contato confirmado">
            <ConfirmedContactForm
              leadId={lead.id}
              values={{
                contact_person: lead.contact_person ?? "",
                phone_confirmed: lead.phone_confirmed ?? "",
                whatsapp_confirmed: lead.whatsapp_confirmed ?? "",
                email_confirmed: lead.email_confirmed ?? "",
              }}
            />
          </Card>
          </div>
          <div className="order-5">
          <Card title="Linha do tempo">
            <ol className="space-y-3">
              {[
                ...activities.map((a) => ({
                  at: a.occurred_at,
                  title: `${KIND_LABEL[a.kind as ActivityKind] ?? a.kind}${a.outcome ? ` — ${OUTCOME_LABEL[a.outcome as Outcome] ?? a.outcome}` : ""}`,
                  detail: a.note,
                })),
                ...history.map((h) => ({
                  at: h.changed_at,
                  title: `Etapa: ${STAGE_LABEL[h.to_stage as Stage] ?? h.to_stage}`,
                  detail: h.reason,
                })),
              ]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((e, i) => (
                  <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-sm">
                    <span className="tabular-nums text-muted">{formatDateTime(e.at)}</span>
                    <span>
                      <span className="font-medium text-ink">{e.title}</span>
                      {e.detail && <span className="block text-xs text-muted">{e.detail}</span>}
                    </span>
                  </li>
                ))}
            </ol>
          </Card>
          </div>
          <div className="order-8">
          {!suppressed && lead.cnpj && <SuppressForm leadId={lead.id} />}
          </div>
        </div>
      </div>
      {/* Celular: espaço para a barra de ações rápidas não cobrir o fim da página */}
      <div aria-hidden className="h-16 lg:hidden" />
    </>
  );
}
