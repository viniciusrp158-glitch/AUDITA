import { LIB_REV_STATUS, type LibRevStatus } from "@/lib/library/labels";

export function LibStatusPill({ status }: { status: LibRevStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${LIB_REV_STATUS[status].cls}`}>{LIB_REV_STATUS[status].label}</span>;
}
