import Link from "next/link";
import { PageHeader } from "@/components/page";
import { Alert } from "@/components/form";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { computeIoc, DISTANCE_ZERO_KM, IOC_WEIGHTS } from "@/lib/prospect/ioc";
import { getNiches, getRegionInputs, RANGES } from "@/lib/prospect/queries";

export const metadata = { title: "Regiões" };

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default async function RegioesPage({ searchParams }: { searchParams: Promise<{ nicho?: string | string[]; raio?: string }> }) {
  const sp = await searchParams;
  const niches = await getNiches();
  const asked = Array.isArray(sp.nicho) ? sp.nicho : sp.nicho ? [sp.nicho] : [];
  const chosen = niches.filter((n) => (asked.length ? asked.includes(n.code) : n.isEntry));
  const maxKm = RANGES.some((r) => String(r.value) === sp.raio) ? Number(sp.raio) : 60;
  const { regions, refreshedAt } = await getRegionInputs(maxKm === 60 ? 60 : maxKm);
  const scored = computeIoc(regions, chosen.map((n) => n.id));
  const top = scored.slice(0, 40);
  const best = scored[0];
  const sumBy = (id: string) => regions.reduce((s, r) => s + (r.byNiche[id] ?? 0), 0);
  const firstNiche = chosen[0]?.code ?? "";
  const ranges = [{ value: 60, label: "Até 60 km de Sorocaba" }, ...RANGES];

  return (
    <>
      <PageHeader
        title="Regiões e Índice de Oportunidade (IOC)"
        description={`Empresas-alvo da base pública de CNPJ por município${refreshedAt ? ` (resumo de ${formatDateTime(refreshedAt)})` : ""}. Escolha os nichos e o raio; clique no município para pesquisar as empresas.`}
      />
      <form className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-white p-4">
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 w-full text-sm font-medium text-ink">Nichos</legend>
          {niches.map((n) => (
            <label key={n.code} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="nicho" value={n.code} defaultChecked={chosen.some((c) => c.code === n.code)} className="size-4" /> {n.name}
            </label>
          ))}
        </fieldset>
        <label className="text-sm font-medium text-ink">
          Raio
          <select name="raio" defaultValue={String(maxKm)} className="mt-1 block rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
            {ranges.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">
          Atualizar
        </button>
      </form>

      {!refreshedAt && <Alert kind="warning">O resumo por município ainda não foi calculado: ele é gerado na carga da base pública de CNPJ.</Alert>}

      {chosen.length > 0 && refreshedAt && (
        <section aria-label="Empresas-alvo por nicho" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chosen.map((n) => (
            <div key={n.id} className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-medium text-muted">{n.name}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{fmt(sumBy(n.id))}</p>
              <p className="text-xs text-muted">empresas-alvo {maxKm > 0 ? `até ${maxKm} km` : "no Estado"}</p>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="min-w-0 lg:col-span-3">
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">IOC</th>
                  <th className="px-3 py-2.5 font-semibold">Município</th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Distância</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Empresas</th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">% no município</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {top.map((r) => (
                  <tr key={r.ibge}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="hidden h-2 w-14 rounded-full bg-surface sm:block">
                          <span className="block h-2 rounded-full bg-navy" style={{ width: `${r.ioc}%` }} />
                        </span>
                        <strong className="tabular-nums">{r.ioc}</strong>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/prospeccao/pesquisar?nicho=${firstNiche}&raio=0&mun=${r.ibge}&run=1`} className="font-medium text-ink hover:text-navy hover:underline">
                        {r.name}
                      </Link>
                      {/* Celular: a distância vai para baixo do nome (a coluna não cabe) */}
                      <span className="block text-xs tabular-nums text-muted sm:hidden">{r.km === null ? "—" : `${Math.round(r.km)} km`}</span>
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-muted sm:table-cell">{r.km === null ? "—" : `${Math.round(r.km)} km`}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(r.selected)}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-muted sm:table-cell">{(r.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                  </tr>
                ))}
                {top.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted">
                      Nenhum município com empresas desses nichos no raio escolhido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {scored.length > top.length && <p className="mt-2 text-xs text-muted">Mostrando os {top.length} primeiros de {scored.length} municípios.</p>}
        </section>

        <div className="lg:col-span-2">
          {best && (
            <Card title={`Como o IOC de ${best.name} foi calculado`}>
              <ul className="space-y-3 text-sm">
                <li>
                  <span className="flex justify-between font-medium text-ink">
                    Quantidade de empresas-alvo <span className="tabular-nums">{best.parts.quantidade.toLocaleString("pt-BR")} de {IOC_WEIGHTS.quantidade}</span>
                  </span>
                  <span className="text-xs text-muted">{fmt(best.selected)} empresas nos nichos escolhidos (escala logarítmica, comparada ao maior município do raio)</span>
                </li>
                <li>
                  <span className="flex justify-between font-medium text-ink">
                    Concentração nos nichos <span className="tabular-nums">{best.parts.concentracao.toLocaleString("pt-BR")} de {IOC_WEIGHTS.concentracao}</span>
                  </span>
                  <span className="text-xs text-muted">{(best.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das empresas-alvo do município</span>
                </li>
                <li>
                  <span className="flex justify-between font-medium text-ink">
                    Distância de Sorocaba <span className="tabular-nums">{best.parts.distancia.toLocaleString("pt-BR")} de {IOC_WEIGHTS.distancia}</span>
                  </span>
                  <span className="text-xs text-muted">Zero a partir de {DISTANCE_ZERO_KM} km (atendimento on-line)</span>
                </li>
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                Resultado normalizado para 0 a 100. Canal de contato e histórico de conversão entram quando houver dados. &quot;Empresa-alvo&quot; = ativa, não é MEI nem empresário individual.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
