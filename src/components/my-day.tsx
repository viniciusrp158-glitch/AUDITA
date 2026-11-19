import Link from "next/link";
import { CalendarClock, ClipboardList, FileClock, Sparkles, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { whatsappLink } from "@/lib/prospect/labels";
import { formatDateTime, formatDay } from "@/lib/format";
import type { DayItem, MyDay } from "@/lib/indicators/meu-dia";

/** Bloco "Meu dia" do Início (Frente A, A5): três listas curtas do que pede ação e o atalho para cada registro. */
export function MyDayPanel({ day }: { day: MyDay }) {
  const empty = !day.followUps.length && !day.demands.length && !day.proposals.length;
  return (
    <section aria-label="Meu dia" className="mb-6 space-y-3" data-testid="meu-dia">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Meu dia</h2>
        {day.newLeads > 0 && (
          <Link href="/prospeccao/funil" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:underline">
            <Sparkles size={15} aria-hidden /> {day.newLeads} lead(s) novo(s) no funil nos últimos 7 dias
          </Link>
        )}
      </div>
      {empty ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-4 text-sm text-muted">
          Nada pendente para hoje: sem retornos de prospecção, demandas atrasadas ou propostas a vencer.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <DayList title="Retornos da prospecção" icon={CalendarClock} items={day.followUps} total={day.followUpsTotal} more="/prospeccao/funil" none="Nenhum retorno para hoje." dateTime />
          <DayList title="Demandas que pedem ação" icon={ClipboardList} items={day.demands} total={day.demandsTotal} more="/demandas" none="Nenhuma demanda atrasada ou parada." />
          <DayList title="Propostas a vencer" icon={FileClock} items={day.proposals} total={day.proposalsTotal} more="/orcamentos" none="Nenhuma proposta vencendo em 7 dias." />
        </div>
      )}
    </section>
  );
}

function DayList({
  title,
  icon: Icon,
  items,
  total,
  more,
  none,
  dateTime = false,
}: {
  title: string;
  icon: LucideIcon;
  items: DayItem[];
  total: number;
  more: string;
  none: string;
  dateTime?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-white">
      <h3 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
        <Icon size={16} className="text-navy" aria-hidden />
        <span className="flex-1">{title}</span>
        {total > 0 && <span className="rounded-full bg-navy px-2 text-xs font-bold text-white">{total}</span>}
      </h3>
      {items.length ? (
        <ul className="flex-1 divide-y divide-line">
          {items.map((i) => (
            <li key={i.href} className="flex items-stretch">
              <Link href={i.href} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-2.5 hover:bg-surface/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{i.title}</span>
                  {i.detail && <span className="block truncate text-xs text-muted">{i.detail}</span>}
                </span>
                <span className={`shrink-0 text-xs tabular-nums ${i.late ? "font-semibold text-danger" : "text-muted"}`}>
                  {dateTime ? formatDateTime(i.when) : i.when.length > 10 ? formatDateTime(i.when) : formatDay(i.when)}
                </span>
              </Link>
              {/* Retorno com contato confirmado: WhatsApp e ligação com um toque (útil no celular) */}
              {(i.whatsapp || i.phone) && (
                <span className="flex shrink-0 items-center gap-1 pr-2">
                  {i.whatsapp && (
                    <a
                      href={whatsappLink(i.whatsapp, "") ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp de ${i.title}`}
                      className="grid size-9 place-items-center rounded-md bg-ok text-white"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                  {i.phone && (
                    <a href={`tel:+55${i.phone}`} aria-label={`Ligar para ${i.title}`} className="grid size-9 place-items-center rounded-md border border-line text-ink">
                      <Phone size={16} />
                    </a>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 px-4 py-4 text-sm text-muted">{none}</p>
      )}
      {total > items.length && (
        <Link href={more} className="border-t border-line px-4 py-2 text-xs font-semibold text-navy hover:underline">
          Ver todos ({total})
        </Link>
      )}
    </div>
  );
}
