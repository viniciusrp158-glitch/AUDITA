import Link from "next/link";
import { PageHeader } from "@/components/page";
import { Alert } from "@/components/form";
import {
  CANDIDATE_LIMIT,
  getCurrentPublication,
  getMunicipalities,
  getNiches,
  logSearchRun,
  RANGES,
  RESULTS_PAGE,
  searchCompanies,
  SIZES,
  type SearchFilters,
  type SizeCode,
} from "@/lib/prospect/queries";
import { SIZE_LABEL } from "@/lib/prospect/score";
import { ResultsForm } from "./results-form";

export const metadata = { title: "Pesquisar empresas" };

type SP = { nicho?: string; raio?: string; mun?: string; porte?: string | string[]; tel?: string; novas?: string; todas?: string; q?: string; p?: string; run?: string };

export default async function PesquisarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [niches, muns, pub] = await Promise.all([getNiches(), getMunicipalities(), getCurrentPublication()]);
  const portes = (Array.isArray(sp.porte) ? sp.porte : sp.porte ? [sp.porte] : SIZES).filter((x): x is SizeCode => SIZES.includes(x as SizeCode));
  const filters: SearchFilters = {
    niche: niches.some((n) => n.code === sp.nicho) ? sp.nicho! : (niches.find((n) => n.isEntry)?.code ?? ""),
    maxKm: RANGES.some((r) => String(r.value) === sp.raio) ? Number(sp.raio) : 50,
    ibge: muns.some((m) => m.ibge_code === sp.mun) ? sp.mun! : null,
    sizes: portes.length ? portes : SIZES,
    withPhone: sp.tel === "1",
    recent: sp.novas === "1",
    hideKnown: sp.todas !== "1",
    q: (sp.q ?? "").slice(0, 80),
    page: Math.max(1, Number(sp.p) || 1),
  };
  const searched = Boolean(sp.nicho);
  const res = searched && pub ? await searchCompanies(filters) : null;
  if (res && !res.error && sp.run === "1") await logSearchRun(filters, res.total, pub?.reference ?? null);
  const pages = res ? Math.max(1, Math.ceil(res.scored / RESULTS_PAGE)) : 1;
  const qs = (p: number) => {
    const u = new URLSearchParams({ nicho: filters.niche, raio: String(filters.maxKm), p: String(p) });
    if (filters.ibge) u.set("mun", filters.ibge);
    filters.sizes.forEach((s) => u.append("porte", s));
    if (filters.withPhone) u.set("tel", "1");
    if (filters.recent) u.set("novas", "1");
    if (!filters.hideKnown) u.set("todas", "1");
    if (filters.q) u.set("q", filters.q);
    return `?${u}`;
  };
  const sel = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";
  const chk = "flex items-center gap-2 text-sm text-ink";

  return (
    <>
      <PageHeader
        title="Pesquisar empresas"
        description={pub ? `Base pública de CNPJ da Receita Federal, publicação ${pub.reference}: empresas ativas de SP que não são MEI nem empresário individual.` : "A base pública de CNPJ ainda não foi carregada no sistema."}
      />
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <form role="search" className="space-y-4 self-start rounded-xl border border-line bg-white p-4">
          <input type="hidden" name="run" value="1" />
          <label className="block text-sm font-medium text-ink">
            Nicho
            <select name="nicho" defaultValue={filters.niche} className={`mt-1 ${sel}`}>
              {niches.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.name}
                  {n.isEntry ? " (entrada)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Região
            <select name="raio" defaultValue={String(filters.maxKm)} className={`mt-1 ${sel}`}>
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Município (opcional)
            <select name="mun" defaultValue={filters.ibge ?? ""} className={`mt-1 ${sel}`}>
              <option value="">Todos da região</option>
              {/* Lista: até 150 km da sede, mais o município vindo da tela de Regiões */}
              {muns.filter((m) => (m.km_from_base ?? 999) <= 150 || m.ibge_code === filters.ibge).map((m) => (
                <option key={m.ibge_code} value={m.ibge_code}>
                  {m.name} ({Math.round(m.km_from_base ?? 0)} km)
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Nome contém
            <input name="q" defaultValue={filters.q} maxLength={80} className={`mt-1 ${sel}`} />
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-ink">Porte (Receita)</legend>
            {SIZES.map((s) => (
              <label key={s} className={chk}>
                <input type="checkbox" name="porte" value={s} defaultChecked={filters.sizes.includes(s)} className="size-4" /> {SIZE_LABEL[s]}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-ink">Refinar</legend>
            <label className={chk}>
              <input type="checkbox" name="tel" value="1" defaultChecked={filters.withPhone} className="size-4" /> Com telefone no cadastro
            </label>
            <label className={chk}>
              <input type="checkbox" name="novas" value="1" defaultChecked={filters.recent} className="size-4" /> Abertas nos últimos 12 meses
            </label>
            <label className={chk}>
              <input type="checkbox" name="todas" value="1" defaultChecked={!filters.hideKnown} className="size-4" /> Mostrar também leads, clientes e &quot;não contatar&quot;
            </label>
          </fieldset>
          <button type="submit" className="w-full rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
            Pesquisar
          </button>
        </form>

        <section className="min-w-0 space-y-3">
          {!pub && <Alert kind="warning">A base pública de CNPJ ainda não foi carregada. A pesquisa fica disponível depois da primeira carga.</Alert>}
          {pub && !searched && <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-muted">Escolha o nicho e a região e clique em Pesquisar.</p>}
          {res?.error && <Alert kind="error">{res.error}</Alert>}
          {res && !res.error && (
            <>
              <p className="text-sm text-ink">
                <strong className="text-lg tabular-nums">{res.total.toLocaleString("pt-BR")}</strong> empresas-alvo encontradas
                {res.truncated && (
                  <span className="block text-xs text-warn">
                    Para ordenar pela nota, o sistema lê as {CANDIDATE_LIMIT.toLocaleString("pt-BR")} mais recentes. Refine pelo município, porte ou nome para ver as demais.
                  </span>
                )}
              </p>
              <ResultsForm
                rows={res.rows.map((r) => ({
                  cnpj: r.cnpj,
                  name: r.trade_name || r.legal_name,
                  legalName: r.legal_name,
                  cnae: r.cnae_main,
                  municipality: r.municipality,
                  km: r.km,
                  size: ({ "01": "ME", "03": "EPP", "05": "Demais" } as const)[r.size_code],
                  hasPhone: !!(r.phone1 || r.phone2),
                  hasEmail: !!r.email,
                  score: r.score.score,
                  band: r.score.band,
                  known: r.known,
                }))}
              />
              {pages > 1 && (
                <nav className="flex items-center justify-between text-sm text-muted" aria-label="Paginação">
                  <span>
                    Página {filters.page} de {pages}
                  </span>
                  <span className="flex gap-3">
                    {filters.page > 1 && <Link href={qs(filters.page - 1)} className="text-navy hover:underline">Anterior</Link>}
                    {filters.page < pages && <Link href={qs(filters.page + 1)} className="text-navy hover:underline">Próxima</Link>}
                  </span>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
