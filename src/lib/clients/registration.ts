import { z } from "zod";
import { clientSchema, contactSchema, fieldErrors, unitSchema } from "@/lib/clients/schema";

import { MAX_CONTACTS, MAX_UNITS } from "@/lib/clients/limits";

export { MAX_CONTACTS, MAX_UNITS };

/** Para o autocadastro, documento, município e UF são obrigatórios (decisão do Diretor, I2.1). */
export const publicClientSchema = clientSchema.superRefine((v, ctx) => {
  if (!v.tax_id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tax_id"], message: "Informe o CNPJ ou CPF." });
  if (!v.address_city) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["address_city"], message: "Informe o município." });
  if (!v.address_state) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["address_state"], message: "Informe a UF." });
});

const publicContactSchema = contactSchema.and(
  z.object({
    unit_index: z
      .string()
      .optional()
      .transform((v) => (v && /^\d$/.test(v) ? Number(v) : null)),
  }),
);

export type RegistrationPayload = {
  client: z.infer<typeof clientSchema>;
  units: z.infer<typeof unitSchema>[];
  contacts: (z.infer<typeof contactSchema> & { unit_index: number | null })[];
};

/** Lê campos "prefixo.N.campo" do formulário. */
function groups(values: Record<string, string>, prefix: string, max: number) {
  const out: Record<string, string>[] = [];
  for (let i = 0; i < max; i++) {
    const g: Record<string, string> = {};
    let any = false;
    for (const [k, v] of Object.entries(values)) {
      const m = k.match(new RegExp(`^${prefix}\\.${i}\\.(\\w+)$`));
      if (m) {
        g[m[1]] = v;
        if (v.trim() !== "" && m[1] !== "is_primary" && m[1] !== "unit_index") any = true;
      }
    }
    if (any) out.push(g);
  }
  return out;
}

export function parseRegistration(values: Record<string, string>):
  | { ok: true; payload: RegistrationPayload }
  | { ok: false; errors: Record<string, string>; message: string } {
  const errors: Record<string, string> = {};

  const client = publicClientSchema.safeParse(values);
  if (!client.success) Object.assign(errors, fieldErrors(client.error));

  const unitInputs = groups(values, "units", MAX_UNITS);
  const units: RegistrationPayload["units"] = [];
  unitInputs.forEach((u, i) => {
    const r = unitSchema.safeParse(u);
    if (r.success) units.push(r.data);
    else for (const [k, m] of Object.entries(fieldErrors(r.error))) errors[`units.${i}.${k}`] = m;
  });

  const contactInputs = groups(values, "contacts", MAX_CONTACTS);
  if (contactInputs.length === 0) errors["contacts.0.full_name"] = "Informe ao menos um contato.";
  const contacts: RegistrationPayload["contacts"] = [];
  contactInputs.forEach((c, i) => {
    const r = publicContactSchema.safeParse({ ...c, unit_id: undefined });
    if (r.success) {
      const idx = r.data.unit_index;
      contacts.push({ ...r.data, unit_id: null, unit_index: idx !== null && idx < units.length ? idx : null });
    } else for (const [k, m] of Object.entries(fieldErrors(r.error))) errors[`contacts.${i}.${k}`] = m;
  });

  if (Object.keys(errors).length > 0 || !client.success) {
    return { ok: false, errors, message: "Revise os campos destacados." };
  }
  return { ok: true, payload: { client: client.data, units, contacts } };
}
