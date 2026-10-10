import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { ChartCard, HBars, MonthlyColumns, SplitBar, type MonthPoint } from "@/components/charts";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { PRESETS, resolvePeriod, type PresetKey } from "@/lib/indicators/period";
import { getAlerts, getIndicators, getMonthlySeries } from "@/lib/indicators/queries";
import { formatBRL, formatPercent } from "@/lib/pricing/engine";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/pricing/labels";

export const metadata = { title: "Início" };

type Status = "concluido" | "em_validacao" | "previsto";

// Andamento do desenvolvimento (S0 — plano aprovado). Não são indicadores de negócio.
const INCREMENTOS: { id: string; titulo: string; status: Status }[] = [
  { id: "I1", titulo: "Fundação: login, permissões, layout e trilha de auditoria", status: "concluido" },
  { id: "I2", titulo: "Clientes, unidades e contatos com código permanente", status: "concluido" },
  { id: "I2.1", titulo: "Autocadastro do cliente por link individual", status: "concluido" },
  { id: "I3", titulo: "Catálogo de serviços (AUDDOC004/005) e situação de liberação", status: "concluido" },
  { id: "I4", titulo: "Demandas — Registro Único de Atendimento", status: "concluido" },
  { id: "I5", titulo: "Parâmetros financeiros e motor de cálculo AUDDOC011", status: "concluido" },
  { id: "I6", titulo: "Revisões e emissão de propostas (DOCX/PDF)", status: "concluido" },
  { id: "I7", titulo: "Biblioteca documental", status: "concluido" },
  { id: "I8", titulo: "Indicadores gerenciais", status: "em_validacao" },
  { id: "I9", titulo: "Homologação do MVP", status: "previsto" },
];

const STATUS = {
  concluido: { label: "Concluído", icon: CheckCircle2, cls: "text-ok" },
  em_validacao: { label: "Em validação", icon: CircleDot, cls: "text-warn" },
  previsto: { label: "Previsto", icon: Circle, cls: "text-muted" },
} as const;

const STAGES: QuoteStatus[] = ["rascunho", "revisada", "emitida", "aceita", "recusada", "cancelada"];

function Kpi({
  label,
  value,
  sub,
  href,
  testid,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  testid: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy" data-testid={testid}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-line bg-white p-4 transition hover:border-navy/40">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-line bg-white p-4">{body}</div>
  );
}

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; teste?: string }>;
}) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const primeiroNome = user.fullName.split(" ")[0];
  const today = todaySaoPaulo();
  const period = resolvePeriod(sp, today);
  // Dados de teste: fora por padrão em produção; no desenvolvimento (só há dados fictícios) entram por padrão, com aviso.
  const includeTest = sp.teste === "1" ? true : sp.teste === "0" ? false : !isProduction;
  const [ind, alerts, monthly] = await Promise.all([
    getIndicators(period.from, period.to, includeTest),
    getAlerts(today, includeTest),
    getMonthlySeries(period.to < today ? period.to : today, includeTest),
  ]);
  const once: MonthPoint[] = monthly.map((r) => ({
    key: r.key,
    label: r.label,
    quoted: Number(r.ind?.quoted.once ?? 0),
    accepted: Number(r.ind?.accepted.once ?? 0),
    quotedCount: r.ind?.quoted.count ?? 0,
    acceptedCount: r.ind?.accepted.count ?? 0,
  }));
  const recurring: MonthPoint[] = monthly.map((r) => ({
    key: r.key,
    label: r.label,
    quoted: Number(r.ind?.quoted.monthly ?? 0),
    accepted: Number(r.ind?.accepted.monthly ?? 0),
    quotedCount: r.ind?.quoted.count ?? 0,
    acceptedCount: r.ind?.accepted.count ?? 0,
  }));
  const hasRecurring = recurring.some((m) => m.quoted > 0 || m.accepted > 0);
  const monthsLabel = `${monthly[0]?.label} a ${monthly[monthly.length - 1]?.label}`;
  const qs = (extra: Record<string, string>) =>
    `?${new URLSearchParams({ periodo: period.key, ...(period.key === "personalizado" ? { de: period.from, ate: period.to } : {}), teste: includeTest ? "1" : "0", ...extra })}`;

  return (
    <>
      <PageHeader title={`Olá, ${primeiroNome}`} description="Indicadores calculados a partir dos registros do sistema (AUDDOC017 §14)." />

      <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="Período dos indicadores">
        <label className="min-w-0 flex-1 basis-44 sm:flex-none">
          <span className="mb-1 block text-xs font-medium text-muted">Período</span>
          <select
            name="periodo"
            defaultValue={period.key}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
          >
            {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
              <option key={k} value={k}>
                {PRESETS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 basis-36 sm:flex-none">
          <span className="mb-1 block text-xs font-medium text-muted">De (personalizado)</span>
          <input type="date" name="de" defaultValue={period.from} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm" />
        </label>
        <label className="min-w-0 flex-1 basis-36 sm:flex-none">
          <span className="mb-1 block text-xs font-medium text-muted">Até (personalizado)</span>
          <input type="date" name="ate" defaultValue={period.to} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm" />
        </label>
        <input type="hidden" name="teste" value={includeTest ? "1" : "0"} />
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Aplicar
        </button>
        <Link href={qs({ teste: includeTest ? "0" : "1" })} className="pb-2 text-xs font-medium text-navy hover:underline" data-testid="toggle-test">
          {includeTest ? "Excluir dados de teste" : "Incluir dados de teste"}
        </Link>
      </form>

      <p className="mb-4 text-sm text-muted" data-testid="period-label">
        Período: <strong className="text-ink">{period.label}</strong>
        {includeTest ? (
          <span className="ml-2 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">Inclui dados de TESTE</span>
        ) : (
          <span className="ml-2 text-xs">Sem dados de teste</span>
        )}
      </p>

      {alerts.length > 0 && (
        <section className="mb-6 space-y-2" aria-label="Alertas" data-testid="alerts">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-danger">
            <BellRing size={16} aria-hidden /> Alertas ({alerts.length})
          </h2>
          {alerts.map((a) => (
            <Link
              key={a.text}
              href={a.href}
              data-testid="alert"
              className={`flex items-start gap-2 rounded-md border border-danger/30 bg-[#fdeceb] px-3 py-2.5 text-sm font-medium text-[#8f2a23] hover:underline ${
                a.kind === "warning" ? "border-l-4 border-l-danger" : ""
              }`}
            >
              {a.kind === "warning" ? (
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-label="Atenção" />
              ) : (
                <BellRing size={16} className="mt-0.5 shrink-0 text-danger" aria-label="Aviso" />
              )}
              {a.text}
            </Link>
          ))}
        </section>
      )}

      {!ind ? (
        <p role="alert" className="mb-6 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível calcular os indicadores.
        </p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
            <Kpi label="Clientes ativos" value={ind.clients_active} sub="Situação atual" href="/clientes" testid="kpi-clients" />
            <Kpi
              label="Propostas em aberto"
              value={ind.quotes_open_now}
              sub={`${ind.quotes_open} criadas no período (rascunho, revisada ou emitida)`}
              href="/orcamentos"
              testid="kpi-open"
            />
            <Kpi
              label="Valor cotado"
              value={formatBRL(ind.quoted.once)}
              sub={
                <>
                  {Number(ind.quoted.monthly) > 0 && <span className="block">+ {formatBRL(ind.quoted.monthly)}/mês (recorrente)</span>}
                  {ind.quoted.count} proposta(s) emitida(s) no período
                </>
              }
              testid="kpi-quoted"
            />
            <Kpi
              label="Valor aceito"
              value={formatBRL(ind.accepted.once)}
              sub={
                <>
                  {Number(ind.accepted.monthly) > 0 && <span className="block">+ {formatBRL(ind.accepted.monthly)}/mês (recorrente)</span>}
                  {ind.accepted.count} proposta(s) aceita(s) no período
                </>
              }
              testid="kpi-accepted"
            />
            <Kpi
              label="Conversão"
              value={ind.conversion === null ? "sem dados" : formatPercent(ind.conversion)}
              sub={`${ind.decisions.accepted} aceita(s) ÷ ${ind.decisions.accepted + ind.decisions.refused} com decisão no período`}
              testid="kpi-conversion"
            />
            <Kpi
              label="Ticket médio aceito"
              value={ind.accepted.avg_once === null ? "sem dados" : formatBRL(ind.accepted.avg_once)}
              sub={ind.accepted.avg_monthly === null ? "Valor único por proposta aceita" : `Mensal: ${formatBRL(ind.accepted.avg_monthly)}/mês`}
              testid="kpi-ticket"
            />
            <Kpi
              label="Demandas pendentes"
              value={ind.demands.pending}
              sub={`${ind.demands.overdue} com prazo vencido`}
              href="/demandas"
              testid="kpi-demands"
            />
            <Kpi label="Demandas recebidas" value={ind.demands.received} sub="No período" href="/demandas?grupo=todas" testid="kpi-received" />
          </section>

          <p className="mt-3 text-xs text-muted">
            Valor cotado e valor aceito são valores de propostas, <strong>não dinheiro recebido</strong>. Valores únicos e mensais nunca são somados.
            O caixa (entradas e saídas efetivas) está previsto para a versão 1.1 (AUDDOC017 RF-18).
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard
              className="lg:col-span-2"
              testid="chart-monthly"
              title={`Quanto cotamos e quanto foi aceito por mês (${monthsLabel})`}
              how={
                <>
                  cada mês tem duas colunas. A <strong>azul</strong> é o total das propostas emitidas no mês; a <strong>verde</strong>, o total das
                  aceitas no mês. Quanto mais a verde se aproxima da azul, melhor. São valores únicos (pagos uma vez); passe o mouse sobre a
                  coluna para ver o valor exato.
                </>
              }
            >
              <MonthlyColumns data={once} />
            </ChartCard>

            {hasRecurring && (
              <ChartCard
                className="lg:col-span-2"
                testid="chart-recurring"
                title={`Contratos mensais: valor por mês cotado e aceito (${monthsLabel})`}
                how="mesma leitura do gráfico acima, mas só com os serviços cobrados todo mês. Fica separado porque valor mensal não se soma com valor único."
              >
                <MonthlyColumns data={recurring} unit=" (por mês)" />
              </ChartCard>
            )}

            <ChartCard
              testid="stages"
              title="Em que etapa estão as cotações do período?"
              how="cada barra conta as cotações criadas no período conforme a situação em que estão hoje. Barras longas em Rascunho ou Revisada indicam propostas paradas antes de chegar ao cliente."
            >
              <HBars
                rows={STAGES.map((s) => ({
                  key: s,
                  label: QUOTE_STATUS[s].label,
                  value: ind.quotes_by_stage[s] ?? 0,
                  hint: `${QUOTE_STATUS[s].label}: ${ind.quotes_by_stage[s] ?? 0} cotação(ões)`,
                }))}
              />
            </ChartCard>

            <div className="grid gap-4">
              <ChartCard
                testid="chart-conversion"
                title="Das propostas respondidas, quantas foram aceitas?"
                how="considera só as propostas em que o cliente respondeu no período. Ex.: 2 aceitas e 1 recusada = 67% de conversão."
              >
                <p className="mb-3 text-3xl font-semibold tabular-nums text-navy">
                  {ind.conversion === null ? "—" : formatPercent(ind.conversion)}
                  <span className="ml-2 text-xs font-normal text-muted">de conversão</span>
                </p>
                <SplitBar
                  testid="split-decisions"
                  emptyText="Nenhuma resposta de cliente no período"
                  parts={[
                    { label: "Aceitas", value: ind.decisions.accepted, color: "#277b43" },
                    { label: "Recusadas", value: ind.decisions.refused, color: "#b63d35" },
                  ]}
                />
              </ChartCard>

              <ChartCard
                testid="chart-demands"
                title="As demandas em aberto estão no prazo?"
                how="mostra todas as demandas ainda em andamento hoje. A parte vermelha são as que já passaram do prazo e precisam de atenção."
              >
                <SplitBar
                  testid="split-demands"
                  emptyText="Nenhuma demanda em aberto"
                  parts={[
                    { label: "No prazo", value: Math.max(0, ind.demands.pending - ind.demands.overdue), color: "#277b43" },
                    { label: "Prazo vencido", value: ind.demands.overdue, color: "#b63d35" },
                  ]}
                />
              </ChartCard>
            </div>
          </div>
        </>
      )}

      <details className="mt-6 rounded-xl border border-line bg-white">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-ink">Andamento do desenvolvimento</summary>
        <ol className="divide-y divide-line border-t border-line">
          {INCREMENTOS.map((inc) => {
            const s = STATUS[inc.status];
            const Icon = s.icon;
            return (
              <li key={inc.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-7 font-mono text-xs font-semibold text-muted">{inc.id}</span>
                <span className="flex-1 text-ink">{inc.titulo}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${s.cls}`}>
                  <Icon size={15} aria-hidden /> {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </details>
    </>
  );
}
