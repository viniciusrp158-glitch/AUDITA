/** Situações da demanda — AUDDOC009 §8.1 (referências gerenciais, não etapas obrigatórias). */
export const DEMAND_STATUS = {
  recebida: { label: "Recebida", cls: "bg-blue/10 text-navy", open: true },
  em_analise: { label: "Em análise", cls: "bg-blue/10 text-navy", open: true },
  aguardando_cliente: { label: "Aguardando cliente", cls: "bg-warn/10 text-warn", open: true },
  proposta_enviada: { label: "Proposta enviada", cls: "bg-blue/10 text-navy", open: true },
  aceita: { label: "Aceita", cls: "bg-ok/10 text-ok", open: true },
  em_execucao: { label: "Em execução", cls: "bg-ok/10 text-ok", open: true },
  entregue: { label: "Entregue", cls: "bg-ok/10 text-ok", open: true },
  encerrada: { label: "Encerrada", cls: "bg-surface text-muted", open: false },
  nao_viavel: { label: "Não viável", cls: "bg-surface text-muted", open: false },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted", open: false },
} as const;

export type DemandStatus = keyof typeof DEMAND_STATUS;
export const DEMAND_STATUS_KEYS = Object.keys(DEMAND_STATUS) as DemandStatus[];
export const OPEN_STATUSES = DEMAND_STATUS_KEYS.filter((k) => DEMAND_STATUS[k].open);
export const CLOSED_STATUSES = DEMAND_STATUS_KEYS.filter((k) => !DEMAND_STATUS[k].open);
/** Situações que exigem motivo. */
export const REASON_REQUIRED: DemandStatus[] = ["nao_viavel", "cancelada"];

export const ORIGINS = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  telefone: "Telefone",
  presencial: "Presencial",
  site: "Site",
  indicacao: "Indicação",
  outro: "Outro",
} as const;
export type Origin = keyof typeof ORIGINS;

export const EVENT_TYPES = {
  nota: "Anotação",
  contato: "Contato com o cliente",
  visita: "Visita / atendimento",
  situacao: "Mudança de situação",
} as const;
export type EventType = keyof typeof EVENT_TYPES;
