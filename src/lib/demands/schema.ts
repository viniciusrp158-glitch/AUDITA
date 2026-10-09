import { z } from "zod";
import { todaySaoPaulo } from "@/lib/format";
import { DEMAND_STATUS_KEYS, ORIGINS } from "./labels";

const uuidOpt = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, { message: "Seleção inválida." });

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const check = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

export const demandSchema = z
  .object({
    client_id: z.string().uuid("Selecione o cliente."),
    unit_id: uuidOpt,
    contact_id: uuidOpt,
    service_id: uuidOpt,
    origin: z.enum(Object.keys(ORIGINS) as [string, ...string[]], { message: "Selecione a origem." }),
    summary: z.string().trim().min(3, "Descreva a solicitação em poucas palavras.").max(200),
    description: optText(4000),
    location: optText(200),
    received_on: day.refine((d) => d <= todaySaoPaulo(), { message: "A data de recebimento não pode ser futura." }),
    due_on: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." }),
    is_recurring: check,
    viability_checked: check,
    viability_notes: optText(2000),
    notes: optText(4000),
  })
  .refine((v) => v.due_on === null || v.due_on >= v.received_on, {
    message: "O prazo não pode ser anterior ao recebimento.",
    path: ["due_on"],
  });
export type DemandInput = z.infer<typeof demandSchema>;

export const statusChangeSchema = z
  .object({
    status: z.enum(DEMAND_STATUS_KEYS as [string, ...string[]], { message: "Selecione a nova situação." }),
    note: optText(2000),
  })
  .refine((v) => !["nao_viavel", "cancelada"].includes(v.status) || (v.note ?? "").length >= 3, {
    message: "Informe o motivo.",
    path: ["note"],
  });

export const eventSchema = z.object({
  event_type: z.enum(["nota", "contato", "visita"], { message: "Selecione o tipo." }),
  occurred_on: day.refine((d) => d <= todaySaoPaulo(), { message: "Registre apenas o que já aconteceu (data não pode ser futura)." }),
  description: z.string().trim().min(2, "Descreva o acompanhamento.").max(4000),
});
