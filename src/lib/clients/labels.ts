import { formatCep, formatCnae, formatPhone, formatTaxId } from "@/lib/br";
import { formatDateTime } from "@/lib/format";
import { COMMERCIAL_STATUS, type CommercialStatus } from "@/lib/services/labels";

export const FIELD_LABELS: Record<string, string> = {
  client_code: "Código",
  person_type: "Tipo",
  legal_name: "Razão social / nome",
  trade_name: "Nome fantasia",
  tax_id: "CNPJ/CPF",
  cnae: "CNAE",
  segment: "Segmento",
  email: "E-mail",
  phone: "Telefone",
  address_zip: "CEP",
  address_street: "Logradouro",
  address_number: "Número",
  address_complement: "Complemento",
  address_district: "Bairro",
  address_city: "Município",
  address_state: "UF",
  notes: "Observações",
  status: "Situação",
  inactivation_reason: "Motivo da inativação",
  inactivated_at: "Inativado em",
  name: "Nome da unidade",
  local_contact: "Contato local",
  full_name: "Nome",
  role_title: "Cargo",
  unit_id: "Unidade",
  is_primary: "Contato principal",
  purpose: "Finalidade",
  is_test: "Registro de teste",
  recipient: "Enviado para",
  cancelled_at: "Cancelado em",
  used_at: "Utilizado em",
  review_note: "Motivo",
  commercial_status: "Situação comercial",
  status_basis: "Fundamento",
  status_reference: "Referência",
  catalog_status: "Situação no catálogo",
  docs_received: "Documentos recebidos",
  rt_confirmed: "RT confirmado",
  resources_confirmed: "Recursos confirmados",
  billing_unit_ref: "Unidade de cobrança",
  audita_notes: "Observações da AUDITA",
};

export const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-warn/10 text-warn" },
  aprovada: { label: "Aprovada", cls: "bg-ok/10 text-ok" },
  recusada: { label: "Recusada", cls: "bg-surface text-muted" },
};

export const ENTITY_LABELS: Record<string, string> = {
  services: "Catálogo de serviços",
  client_invites: "Link de cadastro",
  client_registration_requests: "Solicitação de cadastro",
  clients: "Cliente",
  client_units: "Unidade",
  client_contacts: "Contato",
  app_users: "Usuários",
  session: "Sessão",
};

export const ACTION_LABELS: Record<string, string> = {
  insert: "Inclusão",
  update: "Alteração",
  delete: "Exclusão",
  login: "Entrada no sistema",
  logout: "Saída do sistema",
  access_denied: "Acesso negado",
};

const HIDDEN = new Set(["token_hash", "payload", "invite_id", "reviewed_by", "reviewed_at", "terms_accepted_at", "submitted_at", "expires_at", "status_decided_at", "status_decided_by", "id", "client_id", "created_by", "created_at", "updated_at", "updated_by", "search_text", "inactivated_at"]);

type Ctx = { unitNames?: Record<string, string> };

function show(field: string, value: unknown, ctx: Ctx): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const s = String(value);
  switch (field) {
    case "tax_id":
      return formatTaxId(s);
    case "address_zip":
      return formatCep(s);
    case "phone":
      return formatPhone(s);
    case "cnae":
      return formatCnae(s);
    case "person_type":
      return s === "PJ" ? "Pessoa jurídica" : s === "PF" ? "Pessoa física" : s;
    case "status":
    case "catalog_status":
      return s === "ativo" ? "Ativo" : s === "inativo" ? "Inativo" : s;
    case "commercial_status":
      return COMMERCIAL_STATUS[s as CommercialStatus]?.label ?? s;
    case "docs_received":
    case "rt_confirmed":
    case "resources_confirmed":
      return { nao: "Não", parcial: "Parcial", sim: "Sim", nao_aplicavel: "Não aplicável" }[s] ?? s;
    case "unit_id":
      return ctx.unitNames?.[s] ?? "unidade do cliente";
    default:
      return /^\d{4}-\d{2}-\d{2}T/.test(s) ? formatDateTime(s) : s;
  }
}

/** Resume a alteração registrada na trilha em frases legíveis. */
export function describeChange(action: string, summary: Record<string, unknown>, ctx: Ctx = {}): string[] {
  if (action === "update") {
    return Object.entries(summary)
      .filter(([k]) => !HIDDEN.has(k))
      .map(([k, v]) => {
        const change = v as { de?: unknown; para?: unknown };
        return `${FIELD_LABELS[k] ?? k}: ${show(k, change?.de, ctx)} → ${show(k, change?.para, ctx)}`;
      });
  }
  if (action === "insert") {
    return Object.entries(summary)
      .filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== "" && v !== false)
      .sort(([a], [b]) => order(a) - order(b))
      .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${show(k, v, ctx)}`);
  }
  return [];
}

const ORDER = Object.keys(FIELD_LABELS);
function order(k: string) {
  const i = ORDER.indexOf(k);
  return i === -1 ? 999 : i;
}
