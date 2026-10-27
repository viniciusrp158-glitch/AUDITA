import { DEMAND_STATUS, WAITING_LIMIT_HOURS, waitingLabel, type DemandStatus } from "@/lib/demands/labels";

/** Situação da demanda com texto + cor. */
export function DemandStatusPill({ status }: { status: DemandStatus }) {
  const s = DEMAND_STATUS[status];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

/** Prazo vencido em demanda aberta. */
export function OverdueBadge() {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
      Prazo vencido
    </span>
  );
}

export function RecurringBadge() {
  return <span className="inline-flex whitespace-nowrap rounded-full bg-green/15 px-2 py-0.5 text-xs font-semibold text-green-dark">Recorrente</span>;
}

export function isOverdue(d: { status: DemandStatus; due_on: string | null }, today: string): boolean {
  return Boolean(d.due_on && DEMAND_STATUS[d.status].open && d.due_on < today);
}

/** Mais de 48 h em "Aguardando cliente": cobrar retorno do cliente. */
export function WaitingBadge({ hours }: { hours: number }) {
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn"
      title={`Na situação "Aguardando cliente" há mais de ${WAITING_LIMIT_HOURS} horas`}
      data-testid="waiting-badge"
    >
      {waitingLabel(hours)}
    </span>
  );
}
