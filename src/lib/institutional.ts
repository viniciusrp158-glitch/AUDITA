/**
 * I9.2 — Dados institucionais da AUDITA (proponente das propostas).
 * Referências: AUDDOC013 §3–§4; AUDDOC010-ANX01 (campo "Empresa proponente"); AUDDOC010 §7; AUDDOC015 §2; caderno C1/D6.
 * Nada é inventado: campo vazio = PENDENTE. Validações espelham as do banco (audita.institutional_profiles).
 */
import { z } from "zod";
import { formatCep, formatCnpj, formatCpf, formatPhone, isValidCnpj, isValidCpf, onlyDigits, UFS } from "@/lib/br";

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
  signatory_cpf: string | null;
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
  kind?: "cnpj" | "cpf" | "zip" | "uf" | "email" | "phone" | "url" | "long";
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
      { key: "signatory_cpf", label: "CPF do titular (somente no contrato M04)", source: "D6", max: 14, kind: "cpf", hint: "Usado só na qualificação da CONTRATADA no contrato (caderno J1.10)." },
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
  signatory_cpf: digits([11], "O CPF precisa ter 11 dígitos.").refine((v) => v === null || isValidCpf(v), "CPF inválido (dígitos verificadores)."),
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
  out.signatory_cpf = p?.signatory_cpf ? formatCpf(p.signatory_cpf) : "";
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

/** "Rua X, 219 — Bairro, Cidade/UF, CEP 00000-000" (formato do caderno J1.10). */
export function proponentAddress(p: ProponentSnapshot): string | null {
  const street = [[p.address_street, p.address_number].filter(Boolean).join(", "), p.address_complement].filter(Boolean).join(", ");
  const rest = [p.address_district, [p.address_city, p.address_state].filter(Boolean).join("/"), p.address_zip ? `CEP ${formatCep(p.address_zip)}` : null]
    .filter((x) => x && String(x).trim())
    .join(", ");
  const out = [street, rest].filter(Boolean).join(" — ");
  return out || null;
}

/** Canais oficiais na ordem do caderno J1.10: site · e-mail · telefone. */
export function proponentContacts(p: ProponentSnapshot | null | undefined, opts: { website?: boolean } = {}): string | null {
  if (!p) return null;
  const parts = [opts.website === false ? null : p.website, p.email, p.phone ? formatPhone(p.phone) : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** "Brand — Razão social" (o nome fantasia vem antes e nunca substitui a razão social — caderno J1.01). */
function nameLine(p: ProponentSnapshot): string {
  const brand = brandName(p);
  const name = p.legal_name?.trim() || `razão social ${PENDENTE}`;
  return brand !== name ? `${brand} — ${name}` : name;
}

function isMei(p: ProponentSnapshot): boolean {
  return /microempreendedor|\bMEI\b/i.test(p.legal_nature ?? "");
}

/** "8599-6/04 - Treinamento em ..." → "treinamento em ... (CNAE 8599-6/04)". */
export function activityText(p: ProponentSnapshot | null | undefined): string | null {
  const raw = p?.cnae_main?.trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d\/\d{2})\s*[-–—]\s*(.+)$/);
  if (!m) return raw;
  const desc = m[2].trim();
  return `${desc.charAt(0).toLowerCase()}${desc.slice(1)} (CNAE ${m[1]})`;
}

/** "inscrito no CNPJ sob o nº ..." conforme a natureza jurídica. */
function cnpjClause(p: ProponentSnapshot): string {
  const cnpj = p.cnpj ? formatCnpj(p.cnpj) : PENDENTE;
  return isMei(p) ? `microempreendedor individual inscrito no CNPJ sob o nº ${cnpj}` : `inscrita no CNPJ sob o nº ${cnpj}`;
}

function technicalLead(p: ProponentSnapshot): string | null {
  if (!p.show_technical_lead || !p.technical_lead_name?.trim()) return null;
  const reg = p.technical_lead_registration?.trim();
  return `${p.technical_lead_name.trim()}${reg ? ` — ${reg}` : ""}`;
}

/**
 * Campo "Empresa proponente" (AUDDOC010-ANX01; texto obrigatório do caderno J1.10). Sem versão vigente (ou revisões
 * anteriores ao I9.2): texto de pendência. O que faltar aparece como PENDENTE (nunca inventado).
 */
export function proponentText(p: ProponentSnapshot | null | undefined): string {
  if (!p) return PROPONENT_PENDING;
  const seat = p.full_address_on_proposal
    ? (proponentAddress(p) ?? PENDENTE)
    : [p.address_city, p.address_state].filter(Boolean).join("/") || PENDENTE;
  const lines = [`${nameLine(p)}, ${cnpjClause(p)}, com sede ${p.full_address_on_proposal ? "na" : "em"} ${seat}.`];
  const activity = activityText(p);
  if (activity) lines.push(`Atividade: ${activity}.`);
  const contacts = proponentContacts(p);
  lines.push(contacts ? `Contato: ${contacts}.` : `Contato: ${PENDENTE}`);
  const lead = technicalLead(p);
  if (lead) lines.push(`Responsável técnico: ${lead}.`);
  return lines.join("\n");
}

/** Rodapé de todos os documentos (caderno J1.10): "Marca · Razão social · CNPJ · e-mail · telefone". */
export function issuerLine(p: ProponentSnapshot | null | undefined): string {
  if (!p) return "AUDITA";
  const name = p.legal_name?.trim();
  return [brandName(p), name && name !== brandName(p) ? name : null, p.cnpj ? `CNPJ ${formatCnpj(p.cnpj)}` : null, proponentContacts(p, { website: false })]
    .filter(Boolean)
    .join(" · ");
}

/** "Emitido por AUDITA | SSMA & SGI — Razão social, CNPJ ..." (M03, M05, M06 e certificados — caderno J1.10). */
export function issuedByLine(p: ProponentSnapshot | null | undefined): string {
  if (!p) return PROPONENT_PENDING;
  return `Emitido por ${nameLine(p)}, CNPJ ${p.cnpj ? formatCnpj(p.cnpj) : PENDENTE}.`;
}

/** Qualificação da CONTRATADA no contrato M04 (caderno J1.10). Ausências voltam em `missing`. */
export function contractorQualification(p: ProponentSnapshot | null | undefined): { text: string; missing: string[] } {
  const missing: string[] = [];
  const v = (label: string, value: string | null | undefined) => {
    const t = (value ?? "").trim();
    if (t) return t;
    missing.push(label);
    return `[PENDENTE: ${label}]`;
  };
  const legal = v("Razão social da AUDITA", p?.legal_name);
  const brand = p?.trade_name?.trim() ? `, nome fantasia ${p.trade_name.trim()}` : "";
  const cnpj = p?.cnpj ? formatCnpj(p.cnpj) : v("CNPJ da AUDITA", null);
  const kind = p && isMei(p) ? "microempreendedor individual inscrito" : "inscrita";
  const addr = v("Endereço da AUDITA", p ? proponentAddress(p) : null);
  const rep = v("Titular / representante da AUDITA", p?.signatory_name);
  const cpf = p?.signatory_cpf ? formatCpf(p.signatory_cpf) : v("CPF do titular da AUDITA", null);
  const activity = activityText(p);
  const text =
    `${legal}${brand}, ${kind} no CNPJ sob o nº ${cnpj}, com sede na ${addr}, neste ato representado por seu titular, ${rep}, ` +
    `inscrito no CPF sob o nº ${cpf}.` +
    (activity ? ` Objeto compatível com a atividade registrada: prestação de serviços de ${activity}, conforme a proposta aceita.` : "");
  return { text, missing };
}
