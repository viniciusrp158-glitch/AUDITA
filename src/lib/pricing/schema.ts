import Decimal from "decimal.js";
import { z } from "zod";
import { parseBR, percentToFraction } from "./engine";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

/** Número em formato brasileiro, opcional (vazio ⇒ null; vazio ≠ zero). */
const brNumber = (opts: { max: string; label: string; scale: number }) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const p = parseBR(v);
      if (p === null) return null;
      if (p === "invalid") {
        ctx.addIssue({ code: "custom", message: "Use números (ex.: 1.234,56)." });
        return z.NEVER;
      }
      const d = new Decimal(p);
      if (d.isNeg()) {
        ctx.addIssue({ code: "custom", message: "Não pode ser negativo." });
        return z.NEVER;
      }
      if (d.gt(opts.max)) {
        ctx.addIssue({ code: "custom", message: `${opts.label}: máximo ${opts.max.replace(".", ",")}.` });
        return z.NEVER;
      }
      if (d.decimalPlaces() > opts.scale) {
        ctx.addIssue({ code: "custom", message: `Use no máximo ${opts.scale} casas decimais.` });
        return z.NEVER;
      }
      return d.toString();
    });

/** Percentual digitado ("12,5") ⇒ fração ("0.125"); limites em percentual. */
const brPercent = (opts: { maxPct: number; inclusive: boolean }) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const f = percentToFraction(v);
      if (f === null) return null;
      if (f === "invalid") {
        ctx.addIssue({ code: "custom", message: "Use números (ex.: 11,2)." });
        return z.NEVER;
      }
      const d = new Decimal(f);
      const max = new Decimal(opts.maxPct).div(100);
      if (d.isNeg() || (opts.inclusive ? d.gt(max) : d.gte(max))) {
        ctx.addIssue({ code: "custom", message: `Informe de 0 a ${opts.inclusive ? "" : "menos de "}${opts.maxPct}%.` });
        return z.NEVER;
      }
      if (d.decimalPlaces() > 6) {
        ctx.addIssue({ code: "custom", message: "Use no máximo 4 casas decimais no percentual." });
        return z.NEVER;
      }
      return d.toString();
    });

const money = (label: string) => brNumber({ max: "999999999999.99", label, scale: 2 });
const hours = (label: string) => brNumber({ max: "99999999.99", label, scale: 2 });

export const parameterSetSchema = z.object({
  label: z.string().trim().min(3, "Dê um nome à versão (ex.: Parâmetros 2027).").max(120),
  pro_labore: money("Pró-labore"),
  fixed_costs: money("Despesas fixas"),
  billable_hours: hours("Horas faturáveis"),
  taxes: brPercent({ maxPct: 100, inclusive: false }),
  payment_fees: brPercent({ maxPct: 100, inclusive: false }),
  commission: brPercent({ maxPct: 100, inclusive: false }),
  contingency: brPercent({ maxPct: 500, inclusive: true }),
  target_margin: brPercent({ maxPct: 100, inclusive: false }),
  max_discount: brPercent({ maxPct: 100, inclusive: true }),
  reference_date: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." }),
  validated_by: optText(300),
  notes: optText(2000),
});
export type ParameterSetInput = z.infer<typeof parameterSetSchema>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const quoteItemSchema = z
  .object({
    service_id: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || uuid.test(v), { message: "Serviço inválido." }),
    description: z.string().trim().min(3, "Descreva o item (mín. 3 caracteres).").max(300),
    periodicity: z.enum(["unica", "mensal"], { message: "Selecione a periodicidade." }),
    quantity_ref: optText(120),
    hours_preparation: hours("Horas"),
    hours_execution: hours("Horas"),
    hours_delivery: hours("Horas"),
    hours_followup: hours("Horas"),
    hours_travel: hours("Horas"),
    cost_travel: money("Valor"),
    cost_materials: money("Valor"),
    cost_external: money("Valor"),
    cost_other: money("Valor"),
    contingency: brPercent({ maxPct: 500, inclusive: true }),
    margin: brPercent({ maxPct: 100, inclusive: false }),
    discount: brPercent({ maxPct: 100, inclusive: true }),
    discount_reason: optText(500),
    discount_authorized: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    scope_notes: optText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.discount !== null && new Decimal(v.discount).gt(0) && !v.discount_reason) {
      ctx.addIssue({ code: "custom", path: ["discount_reason"], message: "Justifique o desconto (AUDDOC011 §6)." });
    }
    if (v.discount_authorized && (v.discount === null || !new Decimal(v.discount).gt(0))) {
      ctx.addIssue({ code: "custom", path: ["discount_authorized"], message: "Só há autorização quando houver desconto." });
    }
  });
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;

export const quoteHeaderSchema = z.object({
  validity_days: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const s = (v ?? "").trim();
      if (!s) return null;
      if (!/^\d{1,3}$/.test(s) || Number(s) < 1 || Number(s) > 365) {
        ctx.addIssue({ code: "custom", message: "Informe de 1 a 365 dias." });
        return z.NEVER;
      }
      return Number(s);
    }),
  payment_terms: optText(1000),
  notes: optText(4000),
  // Conteúdo dos modelos AUDDOC010 M01/M02 (I6)
  document_model: z.enum(["ANX01", "ANX02"], { message: "Selecione o modelo." }),
  objective: optText(4000),
  scope_included: optText(4000),
  scope_excluded: optText(4000),
  location_modality: optText(1000),
  schedule: optText(1000),
  methodology: optText(4000),
  deliverables: optText(4000),
  completion_criteria: optText(2000),
  additional_expenses: optText(2000),
  cancellation_terms: optText(2000),
  next_step: optText(1000),
  // Contrato dos serviços mensais (ajuste do Diretor, 10/10/2026)
  contract_start_on: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." }),
  contract_months: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const s = (v ?? "").trim();
      if (!s) return null;
      if (!/^\d{1,3}$/.test(s) || Number(s) < 1 || Number(s) > 120) {
        ctx.addIssue({ code: "custom", message: "Informe de 1 a 120 meses." });
        return z.NEVER;
      }
      return Number(s);
    }),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(5, "Informe o motivo (mín. 5 caracteres).").max(1000),
});

export const acceptanceSchema = z.object({
  accepted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do aceite."),
  accepted_by_name: z.string().trim().min(2, "Informe quem aceitou.").max(200),
  decision_reference: z.string().trim().min(3, "Informe a referência do aceite (e-mail, protocolo, assinatura).").max(500),
  decision_note: optText(2000),
});

export const refusalSchema = z.object({
  decision_note: z.string().trim().min(3, "Informe o motivo.").max(2000),
  decision_reference: optText(500),
});
