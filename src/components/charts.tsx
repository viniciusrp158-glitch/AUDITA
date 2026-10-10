/**
 * Gráficos do painel (I8) — HTML/CSS puro, renderizados no servidor, nas cores do AUDDOC003.
 * Paleta validada (dataviz validate_palette, modo claro): Cotado = azul #0296fd, Aceito = verde #4a9f1a.
 * Situações (aceita/recusada, em dia/vencida) usam as cores de status com rótulo — nunca só a cor.
 * Cada marca tem dica ao passar o mouse (title) e há texto "Como ler" em linguagem simples.
 */
import { formatBRL } from "@/lib/pricing/engine";

export const SERIES = { quoted: "#0296fd", accepted: "#4a9f1a" } as const;

/** R$ compacto para o eixo: R$ 950, R$ 12 mil, R$ 1,2 mi. */
export function compactBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Topo "redondo" do eixo e 4 linhas de grade. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function ChartCard({
  title,
  how,
  children,
  testid,
  className = "",
}: {
  title: string;
  how: React.ReactNode;
  children: React.ReactNode;
  testid: string;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-white p-4 sm:p-5 ${className}`} aria-label={title} data-testid={testid}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        <strong className="font-semibold text-ink">Como ler: </strong>
        {how}
      </p>
    </section>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

export type MonthPoint = { key: string; label: string; quoted: number; accepted: number; quotedCount: number; acceptedCount: number };

/** Colunas agrupadas por mês (mesma unidade, um só eixo): valor cotado × valor aceito. */
export function MonthlyColumns({ data, unit = "" }: { data: MonthPoint[]; unit?: string }) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.quoted, d.accepted])));
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const empty = data.every((d) => d.quoted === 0 && d.accepted === 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        <LegendItem color={SERIES.quoted} label={`Valor cotado${unit}`} />
        <LegendItem color={SERIES.accepted} label={`Valor aceito${unit}`} />
      </div>
      <div className="flex gap-2">
        {/* eixo Y */}
        <div className="relative h-48 w-14 shrink-0 text-right text-[10px] tabular-nums text-muted" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t) * 100}%` }}>
              {compactBRL(max * t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line/70" style={{ top: `${(1 - t) * 100}%` }} aria-hidden />
            ))}
            {empty && (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">Sem propostas emitidas nestes meses.</p>
            )}
            <ol className="absolute inset-0 flex items-end">
              {data.map((d) => (
                <li key={d.key} className="flex h-full flex-1 items-end justify-center gap-[2px] px-1" data-testid="month-group">
                  {(
                    [
                      ["quoted", d.quoted, d.quotedCount, "cotado", "emitida(s)"],
                      ["accepted", d.accepted, d.acceptedCount, "aceito", "aceita(s)"],
                    ] as const
                  ).map(([k, v, n, word, cnt]) => (
                    <span
                      key={k}
                      title={`${d.label} — valor ${word}: ${formatBRL(v)} (${n} proposta(s) ${cnt})`}
                      className="w-full max-w-7 rounded-t-[4px] transition-opacity hover:opacity-80"
                      style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0, background: SERIES[k] }}
                    />
                  ))}
                </li>
              ))}
            </ol>
          </div>
          <ol className="mt-1 flex text-center text-[11px] text-muted">
            {data.map((d) => (
              <li key={d.key} className="flex-1">
                {d.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Barras horizontais, uma série (azul), com o número ao lado. */
export function HBars({ rows }: { rows: { key: string; label: string; value: number; hint: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm" title={r.hint}>
          <span className="truncate text-xs text-ink">{r.label}</span>
          <span className="h-4 rounded-r-[4px] bg-surface">
            <span
              className="block h-full rounded-r-[4px]"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 3 : 0, background: SERIES.quoted }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums text-ink" data-testid={`stage-${r.key}`}>
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Barra de partes de um todo com rótulos (situações com cor de status + texto). */
export function SplitBar({
  parts,
  emptyText,
  testid,
}: {
  parts: { label: string; value: number; color: string }[];
  emptyText: string;
  testid: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div data-testid={testid}>
      {total === 0 ? (
        <div className="flex h-5 items-center justify-center rounded-[4px] bg-surface text-[11px] text-muted">{emptyText}</div>
      ) : (
        <div className="flex h-5 gap-[2px] overflow-hidden rounded-[4px]">
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span
                key={p.label}
                title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
              />
            ))}
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <li key={p.label} className="inline-flex items-center gap-1.5 text-xs text-ink">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.label}: <strong className="tabular-nums">{p.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
