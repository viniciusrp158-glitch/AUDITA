/** V1.1 — rótulos do serviço contratado (RF-07), OS comercial (M05), alteração de escopo (M06) e caixa (RF-18). */

export type ContractStatus = "planejado" | "em_execucao" | "suspenso" | "entregue" | "encerrado" | "cancelado";
export type OrderStatus = "rascunho" | "liberada" | "concluida" | "cancelada";
export type ChangeStatus = "rascunho" | "aprovada" | "cancelada";
export type EventType = "agenda" | "execucao" | "evidencia" | "entrega" | "pendencia" | "ocorrencia" | "anotacao" | "situacao" | "alteracao_escopo" | "documento";

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; cls: string }> = {
  planejado: { label: "Planejado", cls: "bg-surface text-muted" },
  em_execucao: { label: "Em execução", cls: "bg-blue/10 text-navy" },
  suspenso: { label: "Suspenso", cls: "bg-warn/10 text-warn" },
  entregue: { label: "Entregue", cls: "bg-ok/10 text-ok" },
  encerrado: { label: "Encerrado", cls: "bg-surface text-muted" },
  cancelado: { label: "Cancelado", cls: "bg-surface text-muted line-through" },
};
export const CONTRACT_STATUS_KEYS = Object.keys(CONTRACT_STATUS) as ContractStatus[];

/** Próximas situações oferecidas na tela (o banco valida). */
export const CONTRACT_NEXT: Record<ContractStatus, ContractStatus[]> = {
  planejado: ["em_execucao", "suspenso", "cancelado"],
  em_execucao: ["entregue", "suspenso", "cancelado"],
  suspenso: ["em_execucao", "cancelado"],
  entregue: ["encerrado", "em_execucao"],
  encerrado: [],
  cancelado: [],
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho — não liberada", cls: "bg-warn/10 text-warn" },
  liberada: { label: "Liberada para execução", cls: "bg-ok/10 text-ok" },
  concluida: { label: "Concluída", cls: "bg-surface text-muted" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
};
export const CHANGE_STATUS: Record<ChangeStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho — aguardando aceite", cls: "bg-warn/10 text-warn" },
  aprovada: { label: "Aprovada", cls: "bg-ok/10 text-ok" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
};

export const EVENT_TYPES: Record<EventType, string> = {
  agenda: "Agenda",
  execucao: "Execução",
  evidencia: "Evidência",
  entrega: "Entrega",
  pendencia: "Pendência",
  ocorrencia: "Ocorrência",
  anotacao: "Anotação",
  situacao: "Situação",
  alteracao_escopo: "Alteração de escopo",
  documento: "Documento",
};
/** Tipos que o administrador registra manualmente (os demais vêm do fluxo). */
export const MANUAL_EVENTS: EventType[] = ["agenda", "execucao", "evidencia", "entrega", "pendencia", "ocorrencia", "anotacao"];

export type Activity = { atividade: string; entrega?: string; condicao?: string };

/** Atividades da OS: uma por linha, no formato "atividade | entrega/registro | condição" (até 20). */
export function parseActivities(text: string): Activity[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((l) => {
      const [a, e, c] = l.split("|").map((x) => x.trim());
      return { atividade: a.slice(0, 300), ...(e ? { entrega: e.slice(0, 300) } : {}), ...(c ? { condicao: c.slice(0, 300) } : {}) };
    })
    .filter((x) => x.atividade);
}

export function activitiesToText(list: Activity[]): string {
  return list.map((a) => [a.atividade, a.entrega ?? "", a.condicao ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n");
}

export const MODELS = {
  M03: { label: "M03 — Termo de aceite", template: "AUDDOC010-ANX03", hint: "Opcional quando a M01 já tem aceite inequívoco." },
  M04: { label: "M04 — Contrato de prestação de serviços", template: "AUDDOC010-ANX04", hint: "Minuta jurídica: cláusulas 11 e 12 dependem da assessoria jurídica." },
  M05: { label: "M05 — Ordem de serviço comercial", template: "AUDDOC010-ANX05", hint: "Gerada a partir de uma OS-COM." },
  M06: { label: "M06 — Alteração de escopo", template: "AUDDOC010-ANX06", hint: "Gerada a partir de uma alteração ALT." },
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Caixa (AUDDOC011 §7; colunas da aba "Caixa Mensal" do AUDDOC011-ANX01)
// ---------------------------------------------------------------------------------------------------------------
export type CashCategory = "recebimento" | "custo_direto" | "fixo" | "pro_labore" | "tributo" | "outro";
export const CASH_CATEGORIES: Record<CashCategory, { label: string; column: string }> = {
  recebimento: { label: "Recebimento", column: "Recebimentos" },
  custo_direto: { label: "Custo direto", column: "Custos diretos" },
  fixo: { label: "Despesa fixa", column: "Fixos pagos" },
  pro_labore: { label: "Pró-labore", column: "Pró-labore" },
  tributo: { label: "Tributo pago", column: "Tributos pagos" },
  outro: { label: "Outro pagamento", column: "Outros pagos" },
};
export const PAYMENT_CATEGORIES: CashCategory[] = ["custo_direto", "fixo", "pro_labore", "tributo", "outro"];
export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
