import Link from "next/link";
import { ExportLink } from "@/components/board";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { KIND_LABEL, STAGE_LABEL, type ActivityKind, type Stage } from "@/lib/prospect/labels";
import { getProspectResults, isPeriod, PERIODS } from "@/lib/prospect/results";
import { percent } from "@/lib/prospect/results-calc";

export const metadata = { title: "Resultados da prospecção" };

const num = (n: number) => n.toLocaleString("pt-BR");
const pctTxt = (a: number, b: number) => (b ? `${percent(a, b).toLocaleString("pt-BR")}%` : "—");

export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireAppUser();
  const sp = await searchParams;
  const period = isPeriod(sp.periodo) ? sp.periodo : "30";
  const r = await getProspectResults(period);
  const t = r.totals;
  const kpis = [
    { label: "Pesquisas feitas", value: t.searches, hint: `${num(t.found)} empresas encontradas (soma das pesquisas)` },
    { label: "Leads no funil", value: t.leads, hint: "Empresas que entraram no funil no período" },
    { label: "Qualificados", value: t.qualified, hint: pctTxt(t.qualified, t.leads) + " dos leads" },
    { label: "Prioritários", value: t.priority, hint: "Nota de 80 a 100" },
    { label: "Contatos", value: t.contacts, hint: "WhatsApp, ligação e e-mail" },
    { label: "Respostas", value: t.replies, hint: pctTxt(t.replies, t.contacts) + " dos contatos" },
    { label: "Reuniões marcadas", value: t.meetings, hint: pctTxt(t.meetings, t.replies) + " das respostas" },
    { label: "Propostas", value: t.proposals, hint: "Leads que chegaram a \"Proposta enviada\"" },
    { label: "Clientes", value: t.clients, hint: "Leads que viraram cliente" },
  ];
  const maxFunnel = Math.max(1, ...r.funnel.map((f) => f.reached));
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
  const td = "px-3 py-2 tabular-nums";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Resultados da prospecção"
          description="Números do período escolhido: do que foi pesquisado até os clientes conquistados, com conversão por etapa, nicho e canal (AUDDOC020 RP-13)."
        />
        <ExportLink href={`/prospeccao/resultados/exportar?periodo=${period}`} />
      </div>

      <nav className="mb-5 flex flex-wrap gap-1.5" aria-label="Período">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`?periodo=${p.value}`}
            aria-current={p.value === period ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${p.value === period ? "border-navy bg-navy font-semibold text-white" : "border-line bg-white text-muted hover:text-navy"}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {r.error && (
        <div className="mb-4">
          <Alert kind="error">Parte dos dados não pôde ser carregada. Os números abaixo podem estar incompletos.</Alert>
        </div>
      )}
      {r.includeTest && <p className="mb-3 text-xs text-muted">Ambiente de testes: os números incluem os dados marcados como teste.</p>}

      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-white p-3">
            <p className="text-xs font-medium text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{num(k.value)}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{k.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Conversão por etapa">
          {t.leads === 0 ? (
            <p className="text-sm text-muted">Nenhum lead entrou no funil neste período.</p>
          ) : (
            <>
              <ul className="space-y-2" aria-label="Conversão por etapa">
                {r.funnel.map((f) => (
                  <li key={f.stage} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-2 text-sm">
                    <span className="truncate text-muted">{STAGE_LABEL[f.stage as Stage]}</span>
                    <span className="h-2.5 rounded-full bg-surface">
                      <span className="block h-2.5 rounded-full bg-navy" style={{ width: `${Math.round((f.reached / maxFunnel) * 100)}%` }} />
                    </span>
                    <span className="text-right tabular-nums">
                      <strong>{num(f.reached)}</strong> <span className="text-xs text-muted">{f.pct.toLocaleString("pt-BR")}%</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Dos leads que entraram no período, quantos já chegaram a cada etapa.</p>
            </>
          )}
        </Card>

        <Card title="Por canal">
          {r.byChannel.length === 0 ? (
            <p className="text-sm text-muted">Nenhum contato registrado neste período.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-sm" aria-label="Resultados por canal">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Canal</th>
                    <th className={`${th} text-right`}>Registros</th>
                    <th className={`${th} text-right`}>Respostas</th>
                    <th className={`${th} text-right`}>Taxa</th>
                    <th className={`${th} text-right`}>Reuniões</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.byChannel.map((c) => (
                    <tr key={c.kind}>
                      <td className="px-3 py-2">{KIND_LABEL[c.kind as ActivityKind] ?? c.kind}</td>
                      <td className={`${td} text-right`}>{num(c.records)}</td>
                      <td className={`${td} text-right`}>{num(c.replies)}</td>
                      <td className={`${td} text-right`}>{pctTxt(c.replies, c.records)}</td>
                      <td className={`${td} text-right`}>{num(c.meetings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Por nicho">
          {r.byNiche.length === 0 ? (
            <p className="text-sm text-muted">Nenhum lead entrou no funil neste período.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm" aria-label="Resultados por nicho">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Nicho</th>
                    <th className={`${th} text-right`}>Leads</th>
                    <th className={`${th} text-right`}>Contatados</th>
                    <th className={`${th} text-right`}>Responderam</th>
                    <th className={`${th} text-right`}>Propostas</th>
                    <th className={`${th} text-right`}>Clientes</th>
                    <th className={`${th} text-right`}>Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.byNiche.map((n) => (
                    <tr key={n.niche_id ?? "sem"}>
                      <td className="px-3 py-2">{n.niche_id ? (r.nicheName.get(n.niche_id) ?? "—") : "Sem nicho"}</td>
                      <td className={`${td} text-right`}>{num(n.leads)}</td>
                      <td className={`${td} text-right`}>{num(n.contacted)}</td>
                      <td className={`${td} text-right`}>{num(n.replied)}</td>
                      <td className={`${td} text-right`}>{num(n.proposals)}</td>
                      <td className={`${td} text-right`}>{num(n.clients)}</td>
                      <td className={`${td} text-right`}>{pctTxt(n.clients, n.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Conversão = clientes ÷ leads do nicho que entraram no período.</p>
        </Card>
      </div>
    </>
  );
}
