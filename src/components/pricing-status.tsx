import { ITEM_STATUS, PARAM_STATUS, QUOTE_STATUS, type ItemStatus, type ParamStatus, type QuoteStatus } from "@/lib/pricing/labels";

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold";

export function ParamStatusPill({ status }: { status: ParamStatus }) {
  return <span className={`${base} ${PARAM_STATUS[status].cls}`}>{PARAM_STATUS[status].label}</span>;
}

export function QuoteStatusPill({ status }: { status: QuoteStatus }) {
  return <span className={`${base} ${QUOTE_STATUS[status].cls}`}>{QUOTE_STATUS[status].label}</span>;
}

export function ItemStatusPill({ status }: { status: ItemStatus }) {
  return <span className={`${base} ${ITEM_STATUS[status].cls}`}>{ITEM_STATUS[status].label}</span>;
}
