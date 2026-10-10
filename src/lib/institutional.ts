/**
 * I9.2 — Dados institucionais da AUDITA (proponente das propostas).
 * Referências: AUDDOC013 §3–§4; AUDDOC010-ANX01 (campo "Empresa proponente"); AUDDOC010 §7; AUDDOC015 §2; caderno C1/D6.
 * Nada é inventado: campo vazio = PENDENTE. Validações espelham as do banco (audita.institutional_profiles).
 */
import { z } from "zod";
import { formatCep, formatCnpj, formatPhone, isValidCnpj, onlyDigits, UFS } from "@/lib/br";

export type InstitutionalStatus = "rascunho" | "vigente" | "substituido";

/** Campos editáveis (sem metadados). */
export type InstitutionalData = {
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  legal_nature: string | null;
  cnae_main: string | null;
  cnae_secondary: string | null;
  municipal_registration: string | null;
  state_registration: string | null;
  tax_regime: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_state: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  technical_lead_name: string | null;
  technical_lead_registration: string | null;
  show_technical_lead: boolean;
  signatory_name: string | null;
  signatory_role: string | null;
  full_address_on_proposal: boolean;
  notes: string | null;
};

export type InstitutionalProfile = InstitutionalData & {
  id: string;
  version: number;
  status: InstitutionalStatus;
  is_test: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** O que fica congelado em cada revisão de proposta (snapshot.proponent), gravado pelo banco. */
export type ProponentSnapshot = Omit<InstitutionalData, "notes"> & {
  id: string;
  version: number;
  is_test: boolean;
  published_at: string | null;
};

export const INSTITUTIONAL_STATUS: Record<InstitutionalStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-surface text-muted" },
  vigente: { label: "Vigente", cls: "bg-ok/10 text-ok" },
  substituido: { label: "Substituída", cls: "bg-surface text-muted" },
};

type TextKey = Exclude<keyof InstitutionalData, "show_technical_lead" | "full_address_on_proposal">;

export type FieldDef = {
  key: TextKey;
  label: string;
  /** Necessário para a proposta sair sem marcação de pendência. */
  essential?: boolean;
  /** Quem responde no caderno de pendências. */
  source: "C1" | "D6";
  hint?: string;
  max: number;
  kind?: "cnpj" | "zip" | "uf" | "email" | "phone" | "url" | "long";
};

export const FIELD_GROUPS: { title: string; description: string; fields: FieldDef[] }[] = [
  {
    title: "Identificação da empresa",
    description: "Dados do cartão CNPJ e do contrato social (caderno C1 — contabilidade).",
    fields: [
      { key: "legal_name", label: "Razão social", essential: true, source: "C1", max: 200 },
      { key: "trade_name", label: "Nome fantasia", source: "C1", max: 120, hint: "Se vazio, as propostas usam “AUDITA”." },
      { key: "cnpj", label: "CNPJ", essential: true, source: "C1", max: 18, kind: "cnpj", hint: "Somente após a constituição (AUDDOC010 §7)." },
      { key: "legal_nature", label: "Natureza jurídica", source: "C1", max: 120, hint: "Ex.: conforme o cartão CNPJ." },
      { key: "cnae_main", label: "CNAE principal", source: "C1", max: 200 },
      { key: "cnae_secondary", label: "CNAEs secundários", source: "C1", max: 2000, kind: "long" },
      { key: "municipal_registration", label: "Inscrição municipal", source: "C1", max: 40 },
      { key: "state_registration", label: "Inscrição estadual", source: "C1", max: 40, hint: "Se não houver, deixe vazio." },
      { key: "tax_regime", label: "Regime tributário", source: "C1", max: 120 },
    ],
  },
  {
    title: "Endereço",
    description: "Endereço da sede ou do endereço fiscal (caderno C1).",
    fields: [
      { key: "address_street", label: "Logradouro", essential: true, source: "C1", max: 200 },
      { key: "address_number", label: "Número", essential: true, source: "C1", max: 20 },
      { key: "address_complement", label: "Complemento", source: "C1", max: 120 },
      { key: "address_district", label: "Bairro", essential: true, source: "C1", max: 120 },
      { key: "address_zip", label: "CEP", essential: true, source: "C1", max: 9, kind: "zip" },
      { key: "address_city", label: "Município", essential: true, source: "C1", max: 120 },
      { key: "address_state", label: "UF", essential: true, source: "C1", max: 2, kind: "uf" },
    ],
  },
  {
    title: "Contato oficial",
    description: "Canais que aparecem nas propostas (caderno D6 — Diretor; AUDDOC015 §2).",
    fields: [
      { key: "email", label: "E-mail oficial", essential: true, source: "D6", max: 200, kind: "email" },
      { key: "phone", label: "Telefone / WhatsApp", essential: true, source: "D6", max: 16, kind: "phone" },
      { key: "website", label: "Site", source: "D6", max: 200, kind: "url" },
    ],
  },
  {
    title: "Responsáveis",
    description: "Responsável técnico e quem assina pela AUDITA (caderno D6).",
    fields: [
      { key: "technical_lead_name", label: "Responsável técnico", source: "D6", max: 160 },
      { key: "technical_lead_registration", label: "Registro profissional do responsável", source: "D6", max: 80, hint: "Ex.: conselho e número. Não preencha sem documento." },
      { key: "signatory_name", label: "Signatário pela AUDITA", source: "D6", max: 160 },
      { key: "signatory_role", label: "Cargo do signatário", source: "D6", max: 120 },
    ],
  },
];

export const ALL_FIELDS: FieldDef[] = FIELD_GROUPS.flatMap((g) => g.fields);
export const ESSENTIAL_FIELDS = ALL_FIELDS.filter((f) => f.essential);

/** Campos essenciais ainda vazios (o que deixa a proposta com pendência). */
export function pendingEssentials(p: Partial<InstitutionalData> | null | undefined): FieldDef[] {
  return ESSENTIAL_FIELDS.filter((f) => !String(p?.[f.key] ?? "").trim());
}

// ---------------------------------------------------------------------------------------------------------------
// Validação do formulário
// ---------------------------------------------------------------------------------------------------------------

const opt = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v.length >= min, `Mínimo de ${min} caracteres.`);

const digits = (len: number[] , msg: string) =>
  z
    .string()
    .transform((v) => onlyDigits(v))
    .refine((v) => v === "" || len.includes(v.length), msg)
    .transform((v) => (v === "" ? null : v));

export const institutionalSchema = z.object({
  legal_name: opt(200, 3),
  trade_name: opt(120, 2),
  cnpj: digits([14], "O CNPJ precisa ter 14 dígitos.").refine((v) => v === null || isValidCnpj(v), "CNPJ inválido (dígitos verificadores)."),
  legal_nature: opt(120),
  cnae_main: opt(200),
  cnae_secondary: opt(2000),
  municipal_registration: opt(40),
  state_registration: opt(40),
  tax_regime: opt(120),
  address_street: opt(200),
  address_number: opt(20),
  address_complement: opt(120),
  address_district: opt(120),
  address_zip: digits([8], "O CEP precisa ter 8 dígitos."),
  address_city: opt(120),
  address_state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (UFS as readonly string[]).includes(v), "UF inválida.")
    .transform((v) => (v === "" ? null : v)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido.")
    .transform((v) => (v === "" ? null : v)),
  phone: digits([10, 11], "Informe DDD + número (10 ou 11 dígitos)."),
  website: z
    .string()
    .trim()
    .max(200, "Máximo de 200 caracteres.")
    .refine((v) => v === "" || /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v), "Endereço de site inválido.")
    .transform((v) => (v === "" ? null : v)),
  technical_lead_name: opt(160, 2),
  technical_lead_registration: opt(80, 2),
  show_technical_lead: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  signatory_name: opt(160, 2),
  signatory_role: opt(120, 2),
  full_address_on_proposal: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  notes: opt(2000),
});

/** Valores do formulário a partir do registro (para exibir formatado). */
export function toFormValues(p: Partial<InstitutionalData> | null): Record<string, string> {
  const v = (k: TextKey) => String(p?.[k] ?? "");
  const out: Record<string, string> = {};
  for (const f of ALL_FIELDS) out[f.key] = v(f.key);
  out.cnpj = p?.cnpj ? formatCnpj(p.cnpj) : "";
  out.address_zip = p?.address_zip ? formatCep(p.address_zip) : "";
  out.phone = p?.phone ? formatPhone(p.phone) : "";
  out.notes = v("notes");
  out.show_technical_lead = p?.show_technical_lead ? "on" : "";
  out.full_address_on_proposal = p?.full_address_on_proposal === false ? "" : "on";
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Texto para os documentos (M01/M02)
// ---------------------------------------------------------------------------------------------------------------

export const PROPONENT_PENDING = "AUDITA — razão social e CNPJ pendentes de formalização";
const PENDENTE = "PENDENTE";

/** Nome comercial usado nos documentos. */
export function brandName(p: ProponentSnapshot | null | undefined): string {
  return p?.trade_name?.trim() || "AUDITA";
}

export function proponentAddress(p: ProponentSnapshot): string | null {
  const street = [p.address_street, p.address_number].filter(Boolean).join(", ");
  const parts = [
    [street, p.address_complement].filter(Boolean).join(" — "),
    p.address_district,
    [p.address_city, p.address_state].filter(Boolean).join("/"),
    p.address_zip ? `CEP ${formatCep(p.address_zip)}` : null,
  ].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(", ") : null;
}

export function proponentContacts(p: ProponentSnapshot | null | undefined): string | null {
  if (!p) return null;
  const parts = [p.email, p.phone ? formatPhone(p.phone) : null, p.website].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Campo "Empresa proponente" (AUDDOC010-ANX01). Sem versão vigente (ou revisões anteriores ao I9.2): texto de pendência.
 * Com versão vigente: dados preenchidos; o que faltar de razão social/CNPJ aparece como PENDENTE (nunca inventado).
 */
export function proponentText(p: ProponentSnapshot | null | undefined): string {
  if (!p) return PROPONENT_PENDING;
  const brand = brandName(p);
  const name = p.legal_name?.trim() || `razão social ${PENDENTE}`;
  const head = brand !== name ? `${brand} — ${name}` : name;
  const lines = [`${head} — CNPJ ${p.cnpj ? formatCnpj(p.cnpj) : PENDENTE}`];
  if (p.full_address_on_proposal) {
    const addr = proponentAddress(p);
    lines.push(addr ? `Endereço: ${addr}` : `Endereço: ${PENDENTE}`);
  }
  const contacts = proponentContacts(p);
  lines.push(contacts ? `Contato: ${contacts}` : `Contato: ${PENDENTE}`);
  if (p.show_technical_lead && p.technical_lead_name?.trim()) {
    lines.push(
      `Responsável técnico: ${p.technical_lead_name.trim()}${p.technical_lead_registration?.trim() ? ` (${p.technical_lead_registration.trim()})` : ""}`,
    );
  }
  return lines.join("\n");
}

/** Identificação curta para o rodapé: "AUDITA · CNPJ 00.000.000/0000-00 · e-mail · telefone". */
export function issuerLine(p: ProponentSnapshot | null | undefined): string {
  if (!p) return "AUDITA";
  return [brandName(p), p.cnpj ? `CNPJ ${formatCnpj(p.cnpj)}` : null, proponentContacts(p)].filter(Boolean).join(" · ");
}
