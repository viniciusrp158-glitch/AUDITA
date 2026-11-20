import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { ButtonLink, Card, TestBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { STAGES } from "@/lib/prospect/labels";
import { getCurrentPublication, getDashboard } from "@/lib/prospect/queries";
import { requireAppUser } from "@/lib/auth";
import { getGoalProgress } from "@/lib/prospect/goal";
import { getOpportunityCounts } from "@/lib/prospect/opportunities";

export const metadata = { title: "Prospecção" };

/** Metas semanais de respostas e reuniões (planejamento, seção 12); contatos: meta diária de 20 por dia útil (Diretor, 19/11/2026). */
const GOALS = { respostas: 8, reunioes: 2 };

export default async function ProspeccaoPage() {
  const user = await requireAppUser();
  const [d, pub, g, opp] = await Promise.all([getDashboard(), getCurrentPublication(), getGoalProgress(user.id), getOpportunityCounts()]);
  const pctToday = Math.min(100, Math.round((g.today / g.goal) * 100));
  const done = g.today >= g.goal;
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

      {/* Meta do dia (RP-23): o que fazer agora, em uma olhada */}
      <section aria-label="Meta de hoje" className={`mb-4 rounded-2xl p-4 text-white sm:p-5 ${done ? "bg-ok" : "bg-navy"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium opacity-80">{done ? "Meta de hoje batida! 🔥" : "Meta de hoje"}</p>
            <p className="text-3xl font-bold tabular-nums">
              {g.today}
              <span className="text-lg font-medium opacity-80"> / {g.goal} contatos</span>
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{g.streak > 0 ? `🔥 ${g.streak} ${g.streak === 1 ? "dia" : "dias"} seguidos` : "Comece sua sequência hoje"}</p>
            <p className="opacity-80">{g.weekDays} de 5 dias da semana com a meta</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/25">
          <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${pctToday}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/prospeccao/oportunidades?grupo=quente" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-navy">
            🔥 Contatar os Quentes ({opp.counts.quente.toLocaleString("pt-BR")})
          </Link>
          {d.due.length > 0 && (
            <a href="#retornos" className="rounded-xl border border-white/50 px-4 py-2.5 text-sm font-semibold">
              {d.due.length} retorno(s) para hoje
            </a>
          )}
        </div>
      </section>

      <section aria-label="Metas da semana" className="mb-6 grid grid-cols-2 gap-3">
        {goal("Respostas", d.week.respostas, GOALS.respostas)}
        {goal("Reuniões marcadas", d.week.reunioes, GOALS.reunioes)}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div id="retornos" className="scroll-mt-20 lg:col-span-3">
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
