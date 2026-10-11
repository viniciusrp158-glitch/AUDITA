import Link from "next/link";
import { CHANGE_STATUS, CONTRACT_STATUS, ORDER_STATUS, type ChangeStatus, type ContractStatus, type OrderStatus } from "@/lib/execucao/labels";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold";
export const ContractStatusPill = ({ status }: { status: ContractStatus }) => <span className={`${pill} ${CONTRACT_STATUS[status].cls}`}>{CONTRACT_STATUS[status].label}</span>;
export const OrderStatusPill = ({ status }: { status: OrderStatus }) => <span className={`${pill} ${ORDER_STATUS[status].cls}`}>{ORDER_STATUS[status].label}</span>;
export const ChangeStatusPill = ({ status }: { status: ChangeStatus }) => <span className={`${pill} ${CHANGE_STATUS[status].cls}`}>{CHANGE_STATUS[status].label}</span>;

/** Abas de Demandas: o serviço contratado continua o atendimento (AUDDOC009) sem criar entrada nova no menu (AUDDOC017 §4). */
export function DemandTabs({ active, showServices }: { active: "demandas" | "servicos"; showServices: boolean }) {
  if (!showServices) return null;
  const tabs = [
    { key: "demandas", href: "/demandas", label: "Demandas" },
    { key: "servicos", href: "/demandas/servicos", label: "Serviços contratados" },
  ] as const;
  return (
    <nav aria-label="Seções de demandas" className="-mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={`inline-block border-b-2 px-3 py-2 text-sm font-semibold ${t.key === active ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"}`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
