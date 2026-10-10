/**
 * Conteúdo dos documentos ao cliente a partir do snapshot da revisão:
 *  - AUDDOC010-ANX01 (M01) — Proposta comercial integrada (orçamento + aceite)
 *  - AUDDOC010-ANX02 (M02) — Orçamento simplificado
 * Um único modelo de conteúdo alimenta o DOCX e o PDF. Nunca inclui horas, custos, parâmetros ou margens.
 * Dados institucionais da AUDITA vêm da versão vigente congelada na revisão (I9.2); o que não estiver formalizado
 * aparece como PENDENTE (não é inventado).
 */
import Decimal from "decimal.js";
import { formatCnpj, formatCpf, formatPhone } from "@/lib/br";
import { issuerLine, PROPONENT_PENDING, proponentText } from "@/lib/institutional";
import { formatBRL } from "@/lib/pricing/engine";
import { revisionLabel, type QuoteSnapshot } from "./snapshot";

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "fields"; rows: [string, string][] }
  | { kind: "columns"; headers: [string, string]; left: string; right: string }
  | { kind: "table"; headers: string[]; widths: number[]; align: ("left" | "right" | "center")[]; rows: string[][]; totals: [string, string][] }
  | { kind: "notice"; label: string; text: string };

export type DocModel = {
  templateCode: "AUDDOC010-ANX01" | "AUDDOC010-ANX02";
  modelCode: "M01" | "M02";
  title: string;
  reference: string;
  headerRight: string;
  footer: string;
  watermark: string | null;
  fileBase: string;
  blocks: Block[];
};

export const TEST_WATERMARK = "DOCUMENTO DE TESTE — SEM VALIDADE COMERCIAL";
/** Texto usado quando não há dados institucionais publicados (mantido para revisões anteriores ao I9.2). */
export const PROPONENT = PROPONENT_PENDING;

export type EmissionContext = {
  /** Data da emissão (AAAA-MM-DD, fuso de São Paulo). */
  issuedOn: string;
  watermark: boolean;
  templateRevision: string;
  technicalVersion: string;
};

function day(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function addDays(iso: string, days: number): string {
  const dt = new Date(`${iso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const t = (v: string | null | undefined) => (v ?? "").trim();

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/**
 * Data final do contrato: véspera do início do período seguinte. Ex.: 01/11/2026 + 12 meses → 31/10/2027;
 * 15/01/2027 + 1 mês → 14/02/2027; 31/01/2027 + 1 mês → 28/02/2027 (mês sem o dia 31).
 */
export function contractEnd(startIso: string, months: number): string {
  const [y, m, d] = startIso.split("-").map(Number);
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = total % 12;
  const next = d <= daysInMonth(ty, tm) ? new Date(Date.UTC(ty, tm, d)) : new Date(Date.UTC(ty, tm + 1, 1));
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
}

/** "12 meses — de 01/11/2026 a 31/10/2027" (ou início a definir). */
export function contractSummary(start: string | null, months: number): string {
  const n = `${months} ${months === 1 ? "mês" : "meses"}`;
  return start ? `${n} — de ${day(start)} a ${day(contractEnd(start, months))}` : `${n} (início a definir)`;
}

/** Valor total do contrato = valor mensal × meses (somente quando há itens mensais e tempo de contrato). */
function contractTotal(s: QuoteSnapshot): [string, string] | null {
  const months = s.quote.contract_months;
  const monthly = s.results.totals.mensal;
  if (!months || !monthly) return null;
  return [`VALOR TOTAL DO CONTRATO (${months} × ${formatBRL(monthly)})`, formatBRL(new Decimal(monthly).times(months).toFixed(2))];
}

function contractRow(s: QuoteSnapshot): [string, string][] {
  const months = s.quote.contract_months;
  return months && s.results.totals.mensal ? [["Vigência do contrato", contractSummary(s.quote.contract_start_on ?? null, months)]] : [];
}

function clientDoc(s: QuoteSnapshot): string {
  const id = s.client.tax_id ?? "";
  if (!id) return "";
  return s.client.person_type === "PF" ? `CPF ${formatCpf(id)}` : `CNPJ ${formatCnpj(id)}`;
}

function clientAddress(s: QuoteSnapshot): string {
  const c = s.client;
  const street = [c.address_street, c.address_number].filter(Boolean).join(", ");
  const parts = [street, c.address_complement, c.address_district, [c.address_city, c.address_state].filter(Boolean).join("/")]
    .map((x) => t(x))
    .filter(Boolean);
  return parts.join(" — ");
}

function contactLine(s: QuoteSnapshot): string {
  const c = s.contact;
  if (!c) return "";
  return [c.full_name + (c.role_title ? `, ${c.role_title}` : ""), c.email, c.phone ? formatPhone(c.phone) : null].filter(Boolean).join(" — ");
}

function itemsWithPrices(s: QuoteSnapshot) {
  return s.items.map((it) => {
    const r = s.results.items.find((x) => x.id === it.id)!;
    return { it, price: r.price };
  });
}

function totalsRows(s: QuoteSnapshot, labels: { once: string; monthly: string; onlyOnce: string; onlyMonthly: string }): [string, string][] {
  const { unica, mensal } = s.results.totals;
  const contract = contractTotal(s);
  const extra = contract ? [contract] : [];
  if (unica && mensal) return [[labels.once, formatBRL(unica)], [labels.monthly, `${formatBRL(mensal)}/mês`], ...extra];
  if (mensal) return [[labels.onlyMonthly, `${formatBRL(mensal)}/mês`], ...extra];
  return [[labels.onlyOnce, formatBRL(unica)]];
}

function commonHeader(s: QuoteSnapshot, ctx: EmissionContext, title: string, templateCode: string, modelCode: string) {
  const rev = revisionLabel(s.quote.revision);
  const ref = `${s.quote.code} ${rev}`;
  const validUntil = s.quote.validity_days ? addDays(ctx.issuedOn, s.quote.validity_days) : null;
  const validity = s.quote.validity_days
    ? `${s.quote.validity_days} dia${s.quote.validity_days === 1 ? "" : "s"} (até ${day(validUntil!)})`
    : "";
  const kind = modelCode === "M01" ? "Proposta" : "Orcamento";
  return {
    ref,
    validity,
    headerRight: `${title} · ${ref}`,
    footer: `${issuerLine(s.proponent)} · Gerado pelo sistema AUDITA a partir do modelo ${templateCode} ${ctx.templateRevision} (versão técnica ${ctx.technicalVersion}) · Emissão ${day(ctx.issuedOn)}`,
    fileBase: `${ctx.watermark ? "TESTE_" : ""}${s.quote.code}_${rev.replace(".", "")}_${kind}`,
  };
}

function serviceCodes(s: QuoteSnapshot): string {
  return [...new Set(s.items.map((i) => i.service?.service_code).filter(Boolean))].join(", ");
}

export function buildProposalM01(s: QuoteSnapshot, ctx: EmissionContext): DocModel {
  const q = s.quote;
  const h = commonHeader(s, ctx, "Proposta comercial", "AUDDOC010-ANX01", "M01");
  const contractor = [s.client.legal_name, clientDoc(s), s.unit ? `Unidade: ${s.unit.name}` : "", clientAddress(s)].filter(Boolean).join(" — ");
  const rows = itemsWithPrices(s).map(({ it, price }) => [
    [it.service ? `${it.service.service_code} — ${it.description}` : it.description, it.quantity_ref ? `(${it.quantity_ref})` : ""]
      .filter(Boolean)
      .join(" "),
    it.periodicity === "mensal" ? "mensal (recorrente)" : (it.service?.billing_unit_ref ?? "serviço"),
    formatBRL(price),
  ]);
  return {
    templateCode: "AUDDOC010-ANX01",
    modelCode: "M01",
    title: "Proposta comercial",
    reference: h.ref,
    headerRight: h.headerRight,
    footer: h.footer,
    watermark: ctx.watermark ? TEST_WATERMARK : null,
    fileBase: h.fileBase,
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Identificação", `${h.ref} | Emissão: ${day(ctx.issuedOn)} | Validade: ${h.validity}`],
          ["Empresa contratante", contractor],
          ["Representante / contato", contactLine(s)],
          ["Empresa proponente", proponentText(s.proponent)],
          ["Referência interna", `Cliente ${s.client.code} · Demanda ${s.demand.code} · Serviço AUDDOC005 ${serviceCodes(s)}`],
        ],
      },
      { kind: "heading", text: "1. Objetivo e necessidade do cliente" },
      { kind: "paragraph", text: t(q.objective) },
      { kind: "heading", text: "2. Escopo, atividades e exclusões" },
      { kind: "columns", headers: ["INCLUÍDO", "EXCLUÍDO / DEPENDE DE CONTRATAÇÃO"], left: t(q.scope_included), right: t(q.scope_excluded) },
      { kind: "heading", text: "3. Metodologia, agenda e entregáveis" },
      {
        kind: "fields",
        rows: [
          ["Local / modalidade", t(q.location_modality)],
          ["Prazo / vigência", t(q.schedule)],
          ["Metodologia", t(q.methodology)],
          ["Entregáveis", t(q.deliverables)],
          ["Critério de conclusão", t(q.completion_criteria)],
        ],
      },
      { kind: "heading", text: "4. Investimento e condições comerciais" },
      {
        kind: "table",
        headers: ["ITEM / QUANTIDADE", "UNIDADE", "VALOR"],
        widths: [52, 24, 24],
        align: ["left", "left", "right"],
        rows,
        totals: totalsRows(s, {
          once: "VALOR TOTAL — PARCELA ÚNICA",
          monthly: "VALOR MENSAL (RECORRENTE)",
          onlyOnce: "VALOR TOTAL DA PROPOSTA",
          onlyMonthly: "VALOR MENSAL DA PROPOSTA",
        }),
      },
      {
        kind: "fields",
        rows: [
          ...contractRow(s),
          ["Pagamento", t(q.payment_terms)],
          ["Despesas adicionais", t(q.additional_expenses)],
          ["Reagendamento e cancelamento", t(q.cancellation_terms)],
        ],
      },
      { kind: "heading", text: "5. Responsabilidades e informações prévias" },
      {
        kind: "paragraph",
        text:
          "AUDITA: executar apenas atividades liberadas e compatíveis com as habilitações e condições acordadas; registrar resultados e comunicar limitações relevantes. " +
          "Cliente: designar contato, fornecer informações corretas, assegurar acesso e condições seguras, e executar as providências de sua responsabilidade.",
      },
      { kind: "heading", text: "6. Condições e aceite da proposta" },
      {
        kind: "paragraph",
        text:
          `O aceite deve identificar inequivocamente esta proposta (${h.ref}), seu preço, escopo e condições. ` +
          "Quando o serviço exigir contrato complementar, o início da execução dependerá também da formalização correspondente.",
      },
      {
        kind: "fields",
        rows: [
          ["Aceite do cliente", "Nome: ________________________________________\nCargo: ______________________   Data: ____/____/________\nAssinatura ou manifestação eletrônica rastreável:\n\n________________________________________"],
          ["Referência do aceite", "( ) E-mail   ( ) Sistema   ( ) Protocolo   ( ) Assinatura   ( ) Anexo\nIdentificação: ________________________________"],
          ["Início autorizado?", "( ) Sim   ( ) Não — dependente de condições e liberação comercial"],
        ],
      },
      {
        kind: "notice",
        label: "ATENÇÃO",
        text: "A assinatura deste modelo não significa, por si só, liberação de serviço ainda classificado como condicionado na AUDDOC004.",
      },
    ],
  };
}

export function buildBudgetM02(s: QuoteSnapshot, ctx: EmissionContext): DocModel {
  const q = s.quote;
  const h = commonHeader(s, ctx, "Orçamento simplificado", "AUDDOC010-ANX02", "M02");
  const items = itemsWithPrices(s);
  const request = s.items
    .map((it) => [it.service ? `${it.service.service_code} — ${it.service.name}` : it.description, it.quantity_ref].filter(Boolean).join(" · "))
    .concat(s.unit ? [`Local: ${s.unit.name}`] : [])
    .join("\n");
  const inclusions = [t(q.scope_included), t(q.scope_excluded) ? `Exclusões: ${t(q.scope_excluded)}` : ""].filter(Boolean).join("\n");
  return {
    templateCode: "AUDDOC010-ANX02",
    modelCode: "M02",
    title: "Orçamento simplificado",
    reference: h.ref,
    headerRight: h.headerRight,
    footer: h.footer,
    watermark: ctx.watermark ? TEST_WATERMARK : null,
    fileBase: h.fileBase,
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Referência", `${h.ref} | Data ${day(ctx.issuedOn)} | Validade ${h.validity}`],
          ["Cliente / responsável", [`${s.client.legal_name}${clientDoc(s) ? ` (${clientDoc(s)})` : ""}`, contactLine(s)].filter(Boolean).join(" — ")],
          ["Solicitação", request],
          ["Condição de viabilidade", "Serviço(s) liberado(s) comercialmente na AUDDOC004 (situação “Apto comercialmente” — AUDDOC005 §14)."],
        ],
      },
      {
        kind: "table",
        headers: ["DESCRIÇÃO DO ITEM", "QTDE", "VALOR UNIT.", "TOTAL"],
        widths: [52, 10, 19, 19],
        align: ["left", "center", "right", "right"],
        rows: items.map(({ it, price }) => [
          `${it.description}${it.quantity_ref ? ` (${it.quantity_ref})` : ""}${it.periodicity === "mensal" ? " — mensal" : ""}`,
          "1",
          formatBRL(price),
          formatBRL(price),
        ]),
        totals: totalsRows(s, { once: "TOTAL — PARCELA ÚNICA", monthly: "TOTAL MENSAL", onlyOnce: "TOTAL", onlyMonthly: "TOTAL MENSAL" }),
      },
      {
        kind: "fields",
        rows: [
          ["Inclusões / exclusões", inclusions],
          ["Prazo estimado", t(q.schedule)],
          ...contractRow(s),
          ["Condição de pagamento", t(q.payment_terms)],
          ["Próximo passo", t(q.next_step)],
        ],
      },
      {
        kind: "notice",
        label: "USO CORRETO",
        text: "Orçamento isolado não deve gerar execução sem condições mínimas de escopo, aceite e formalização aplicáveis.",
      },
    ],
  };
}

export function buildDocument(s: QuoteSnapshot, ctx: EmissionContext): DocModel {
  return s.quote.model === "ANX02" ? buildBudgetM02(s, ctx) : buildProposalM01(s, ctx);
}

/** Soma de conferência: total do documento = soma das linhas. */
export function documentTotalsMatch(s: QuoteSnapshot): boolean {
  const sum = (p: "unica" | "mensal") =>
    s.items
      .filter((i) => i.periodicity === p)
      .reduce((acc, i) => acc.plus(s.results.items.find((r) => r.id === i.id)!.price ?? "0"), new Decimal(0))
      .toFixed(2);
  const { unica, mensal } = s.results.totals;
  return (unica === null || unica === sum("unica")) && (mensal === null || mensal === sum("mensal"));
}
