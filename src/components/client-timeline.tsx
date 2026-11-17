import Link from "next/link";
import { Calculator, ClipboardList, Target, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { TIMELINE_KINDS, type TimelineEvent, type TimelineKind } from "@/lib/clients/timeline";

const ICON: Record<TimelineKind, { icon: LucideIcon; cls: string }> = {
  prospeccao: { icon: Target, cls: "bg-blue/10 text-navy" },
  demanda: { icon: ClipboardList, cls: "bg-surface text-navy" },
  proposta: { icon: Calculator, cls: "bg-ok/10 text-ok" },
  servico: { icon: Wrench, cls: "bg-warn/10 text-warn" },
  financeiro: { icon: Wallet, cls: "bg-surface text-ink" },
};

/** Linha do tempo da ficha 360° (A6): filtros por tipo e eventos do mais recente ao mais antigo, agrupados por mês. */
export function ClientTimeline({
  events,
  truncated,
  active,
  base,
  showAdminKinds,
}: {
  events: TimelineEvent[];
  truncated: boolean;
  active: TimelineKind | null;
  base: string;
  showAdminKinds: boolean;
}) {
  const kinds = (Object.keys(TIMELINE_KINDS) as TimelineKind[]).filter((k) => showAdminKinds || (k !== "servico" && k !== "financeiro"));
  const shown = active ? events.filter((e) => e.kind === active) : events;
  const month = (e: TimelineEvent) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" }).format(new Date(e.at));
  const groups: { month: string; items: TimelineEvent[] }[] = [];
  for (const e of shown) {
    const m = month(e);
    if (groups.at(-1)?.month !== m) groups.push({ month: m, items: [] });
    groups.at(-1)!.items.push(e);
  }
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1 text-xs ${on ? "border-navy bg-navy font-semibold text-white" : "border-line bg-white text-muted hover:text-navy"}`;

  return (
    <section aria-label="Linha do tempo" className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Tipo de registro">
        <Link href={base} className={chip(!active)} aria-current={!active ? "page" : undefined}>
          Tudo ({events.length})
        </Link>
        {kinds.map((k) => {
          const n = events.filter((e) => e.kind === k).length;
          return (
            <Link key={k} href={`${base}&tipo=${k}`} className={chip(active === k)} aria-current={active === k ? "page" : undefined}>
              {TIMELINE_KINDS[k]} ({n})
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {active ? "Nenhum registro deste tipo para o cliente." : "Ainda não há registros para este cliente. Demandas, propostas e contatos aparecem aqui."}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.month}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.month}</h3>
              <ol className="space-y-1">
                {g.items.map((e, i) => {
                  const { icon: Icon, cls } = ICON[e.kind];
                  const body = (
                    <>
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${cls}`} aria-hidden>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{e.title}</span>
                        {e.detail && <span className="block break-words text-xs text-muted">{e.detail}</span>}
                      </span>
                      <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={e.at}>
                        {e.dayOnly ? formatDate(e.at) : formatDateTime(e.at)}
                      </time>
                    </>
                  );
                  return (
                    <li key={`${e.at}-${i}`}>
                      {e.href ? (
                        <Link href={e.href} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-2 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
      {truncated && <p className="mt-4 text-xs text-muted">Mostrando os 200 registros mais recentes.</p>}
    </section>
  );
}
