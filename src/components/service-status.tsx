import { COMMERCIAL_STATUS, type CommercialStatus } from "@/lib/services/labels";

/** Situação comercial com texto + cor (nunca só cor). */
export function StatusPill({ status }: { status: CommercialStatus }) {
  const s = COMMERCIAL_STATUS[status];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
