import {
  ITEM_STATUS,
  PARAM_STATUS,
  QUOTE_STATUS,
  REVISION_STATUS,
  type ItemStatus,
  type ParamStatus,
  type QuoteStatus,
  type RevisionStatus,
} from "@/lib/pricing/labels";

export function RevisionStatusPill({ status }: { status: RevisionStatus }) {
  return <span className={`${base} ${REVISION_STATUS[status].cls}`}>{REVISION_STATUS[status].label}</span>;
}

export function ExpiredBadge() {
  return <span className={`${base} bg-warn/10 text-warn`}>Validade vencida</span>;
}

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
