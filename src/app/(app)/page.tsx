import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, Info } from "lucide-react";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { PRESETS, resolvePeriod, type PresetKey } from "@/lib/indicators/period";
import { getAlerts, getIndicators } from "@/lib/indicators/queries";
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
  const [ind, alerts] = await Promise.all([getIndicators(period.from, period.to, includeTest), getAlerts(today, includeTest)]);
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

          <section className="mt-6 rounded-xl border border-line bg-white" aria-label="Cotações por estágio">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Cotações criadas no período, por situação atual</h2>
            <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6" data-testid="stages">
              {STAGES.map((s) => (
                <li key={s} className="bg-white px-4 py-3">
                  <p className="text-xs text-muted">{QUOTE_STATUS[s].label}</p>
                  <p className="text-xl font-semibold tabular-nums text-ink" data-testid={`stage-${s}`}>
                    {ind.quotes_by_stage[s] ?? 0}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {alerts.length > 0 && (
        <section className="mt-6 space-y-2" aria-label="Alertas" data-testid="alerts">
          <h2 className="text-sm font-semibold text-ink">Alertas</h2>
          {alerts.map((a) => (
            <Link
              key={a.text}
              href={a.href}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm hover:underline ${
                a.kind === "warning" ? "border-warn/40 bg-warn/5 text-warn" : "border-line bg-white text-ink"
              }`}
            >
              {a.kind === "warning" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0 text-navy" />}
              {a.text}
            </Link>
          ))}
        </section>
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
