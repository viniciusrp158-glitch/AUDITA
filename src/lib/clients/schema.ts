import { z } from "zod";
import { isValidCnpj, isValidCpf, onlyDigits, UFS } from "@/lib/br";

/** Campo de texto opcional: vazio vira null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optDigits = (pattern: RegExp, message: string) =>
  z
    .string()
    .optional()
    .transform((v) => onlyDigits(v) || null)
    .refine((v) => v === null || pattern.test(v), { message });

const optEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, { message: "E-mail inválido." });

const uf = z
  .string()
  .optional()
  .transform((v) => (v ? v.toUpperCase() : null))
  .refine((v) => v === null || (UFS as readonly string[]).includes(v), { message: "UF inválida." });

export const addressSchema = {
  address_zip: optDigits(/^\d{8}$/, "CEP deve ter 8 dígitos."),
  address_street: optText(200),
  address_number: optText(20),
  address_complement: optText(100),
  address_district: optText(100),
  address_city: optText(100),
  address_state: uf,
};

export const clientSchema = z
  .object({
    person_type: z.enum(["PJ", "PF"], { message: "Selecione o tipo de pessoa." }),
    legal_name: z.string().trim().min(2, "Informe a razão social ou o nome.").max(200),
    trade_name: optText(200),
    tax_id: z
      .string()
      .optional()
      .transform((v) => onlyDigits(v) || null),
    cnae: optDigits(/^\d{7}$/, "CNAE deve ter 7 dígitos (ex.: 7119-7/03)."),
    segment: optText(160),
    email: optEmail,
    phone: optDigits(/^\d{10,13}$/, "Telefone deve ter DDD e número."),
    notes: optText(4000),
    ...addressSchema,
  })
  .superRefine((v, ctx) => {
    if (v.tax_id === null) return;
    const ok = v.person_type === "PJ" ? isValidCnpj(v.tax_id) : isValidCpf(v.tax_id);
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tax_id"],
        message: v.person_type === "PJ" ? "CNPJ inválido." : "CPF inválido.",
      });
    }
  });
export type ClientInput = z.infer<typeof clientSchema>;

export const unitSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da unidade.").max(160),
  tax_id: z
    .string()
    .optional()
    .transform((v) => onlyDigits(v) || null)
    .refine((v) => v === null || isValidCnpj(v), { message: "CNPJ da unidade inválido." }),
  local_contact: optText(200),
  notes: optText(2000),
  ...addressSchema,
});
export type UnitInput = z.infer<typeof unitSchema>;

export const contactSchema = z
  .object({
    full_name: z.string().trim().min(2, "Informe o nome do contato.").max(160),
    role_title: optText(120),
    email: optEmail,
    phone: optDigits(/^\d{10,13}$/, "Telefone deve ter DDD e número."),
    unit_id: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.string().uuid().safeParse(v).success, { message: "Unidade inválida." }),
    is_primary: z
      .union([z.literal("on"), z.literal("true"), z.literal("")])
      .optional()
      .transform((v) => v === "on" || v === "true"),
    purpose: optText(300),
  })
  .refine((v) => v.email !== null || v.phone !== null, {
    message: "Informe ao menos um e-mail ou telefone.",
    path: ["email"],
  });
export type ContactInput = z.infer<typeof contactSchema>;

export const inactivationSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo (mínimo de 3 caracteres).").max(500),
});

/** Converte FormData em objeto simples (somente campos de texto). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Primeiro erro por campo, para exibir junto ao campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
