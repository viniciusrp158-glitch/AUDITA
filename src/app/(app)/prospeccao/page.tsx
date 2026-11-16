import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { ButtonLink, Card, TestBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { STAGES } from "@/lib/prospect/labels";
import { getCurrentPublication, getDashboard } from "@/lib/prospect/queries";

export const metadata = { title: "Prospecção" };

/** Metas semanais iniciais propostas no planejamento (seção 12), a calibrar após 4 semanas de uso. */
const GOALS = { contatos: 25, respostas: 8, reunioes: 2 };

export default async function ProspeccaoPage() {
  const [d, pub] = await Promise.all([getDashboard(), getCurrentPublication()]);
  const max = Math.max(1, ...STAGES.map((s) => d.byStage[s.value]));
  const goal = (label: string, value: number, target: number) => {
    const pct = Math.min(100, Math.round((value / target) * 100));
    return (
      <div key={label} className="rounded-xl border border-line bg-white p-4">
        <p className="text-xs font-medium text-muted">{label} (7 dias)</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
          {value}
          <span className="text-sm font-medium text-muted"> / {target}</span>
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-surface">
          <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-ok" : "bg-navy"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Prospecção"
          description={pub ? `Base pública de CNPJ da Receita Federal — publicação ${pub.reference} (${pub.rows_loaded.toLocaleString("pt-BR")} empresas-alvo em SP).` : "A base pública de CNPJ ainda não foi carregada."}
        />
        <ButtonLink href="/prospeccao/pesquisar">
          <Search size={16} /> Pesquisar empresas
        </ButtonLink>
      </div>

      <section aria-label="Metas da semana" className="mb-6 grid gap-3 sm:grid-cols-3">
        {goal("Contatos feitos", d.week.contatos, GOALS.contatos)}
        {goal("Respostas", d.week.respostas, GOALS.respostas)}
        {goal("Reuniões marcadas", d.week.reunioes, GOALS.reunioes)}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Retornos de hoje e atrasados" actions={<Link href="/prospeccao/funil" className="text-sm font-semibold text-navy hover:underline">Ver funil</Link>}>
            {d.due.length === 0 ? (
              <p className="text-sm text-muted">Nenhum retorno para hoje. Pesquise empresas ou registre contatos para agendar os próximos.</p>
            ) : (
              <ul className="-my-2 divide-y divide-line">
                {d.due.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-surface text-sm font-bold text-ink">{l.score ?? "—"}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/prospeccao/leads/${l.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                        {l.trade_name || l.legal_name}
                      </Link>
                      {l.is_test && <TestBadge />}
                      <p className="text-xs text-muted">
                        {l.municipality ?? "—"} · {l.next_action_note || "Retorno agendado"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${new Date(l.next_action_at!).getTime() < Date.now() ? "bg-alert-bg text-alert-ink" : "bg-warn/10 text-warn"}`}>
                      {formatDateTime(l.next_action_at!)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card title="Funil — leads por etapa">
            <ul className="space-y-2">
              {STAGES.map((s) => (
                <li key={s.value} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-2 text-sm">
                  <span className="truncate text-muted">{s.label}</span>
                  <span className="h-2.5 rounded-full bg-surface">
                    <span className="block h-2.5 rounded-full bg-navy" style={{ width: `${Math.round((d.byStage[s.value] / max) * 100)}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{d.byStage[s.value]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Parados há mais de 7 dias: <strong className={d.stale ? "text-danger" : "text-ink"}>{d.stale}</strong> · Em &quot;não contatar&quot;:{" "}
              <strong className="text-ink">{d.suppressions}</strong>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
