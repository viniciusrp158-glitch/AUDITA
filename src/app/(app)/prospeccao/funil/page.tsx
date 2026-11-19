import { Suspense } from "react";
import { SavedFilters } from "@/components/saved-filters";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { Alert } from "@/components/form";
import { TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { STAGES } from "@/lib/prospect/labels";
import { getNiches, listLeads } from "@/lib/prospect/queries";

export const metadata = { title: "Funil comercial" };

const tone = (s: number | null) => (s === null ? "bg-surface text-muted" : s >= 80 ? "bg-ok/10 text-ok" : s >= 65 ? "bg-blue/10 text-navy" : "bg-surface text-muted");

export default async function FunilPage({ searchParams }: { searchParams: Promise<{ meus?: string; nicho?: string; q?: string; etapa?: string }> }) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const niches = await getNiches();
  const nicheId = niches.find((n) => n.code === sp.nicho)?.id;
  const { rows, error } = await listLeads({ owner: sp.meus === "1" ? user.id : undefined, niche: nicheId, q: sp.q });
  const weekAgo = Date.now() - 7 * 86_400_000;
  const stale = (l: (typeof rows)[number]) =>
    !["identificada", "importado", "cliente", "perdido"].includes(l.stage) && (!l.last_activity_at || new Date(l.last_activity_at).getTime() < weekAgo);
  const sel = "rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy";
  const columns = STAGES.map((s) => ({
    ...s,
    cards: rows.filter((r) => r.stage === s.value).sort((a, b) => Number(stale(b)) - Number(stale(a)) || (b.score ?? 0) - (a.score ?? 0)),
  }));
  // Celular (layout próprio): uma etapa por vez, escolhida na faixa de etapas; começa na primeira com leads em andamento
  const mobileStage =
    columns.find((c) => c.value === sp.etapa)?.value ??
    columns.find((c) => c.cards.length && c.value !== "identificada" && c.value !== "cliente" && c.value !== "perdido")?.value ??
    columns.find((c) => c.cards.length)?.value ??
    "importado";
  const mobile = columns.find((c) => c.value === mobileStage)!;
  const keep = { ...(sp.q && { q: sp.q }), ...(sp.nicho && { nicho: sp.nicho }), ...(sp.meus === "1" && { meus: "1" }) };

  const card = (l: (typeof rows)[number], big = false) => (
    <Link
      href={`/prospeccao/leads/${l.id}`}
      className={`block rounded-lg border border-line bg-white transition hover:border-navy/40 active:bg-surface ${big ? "p-4" : "p-3"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={`${big ? "text-base" : "text-sm"} font-semibold leading-snug text-ink`}>{l.trade_name || l.legal_name}</span>
        <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${tone(l.score)}`}>{l.score ?? "—"}</span>
      </span>
      <span className="mt-1 block text-xs text-muted">
        {l.municipality ?? "—"}
        {l.next_action_at ? ` · retorno ${formatDate(l.next_action_at)}` : ""}
      </span>
      {stale(l) && <span className="mt-1 block text-xs font-semibold text-alert-ink">Sem movimentação há mais de 7 dias</span>}
      {l.is_test && <TestBadge />}
    </Link>
  );

  return (
    <>
      <PageHeader title="Funil comercial" description="Abra o cartão para registrar contatos, agendar o retorno e mudar a etapa. Os parados há mais de 7 dias aparecem primeiro." />
      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        {sp.etapa && <input type="hidden" name="etapa" value={sp.etapa} />}
        <label className="min-w-56 flex-1">
          <span className="sr-only">Pesquisar no funil</span>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Nome ou CNPJ" className={`w-full ${sel}`} />
        </label>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">Nicho</span>
          <select name="nicho" defaultValue={sp.nicho ?? ""} className={`w-full ${sel}`}>
            <option value="">Todos os nichos</option>
            {niches.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="meus" value="1" defaultChecked={sp.meus === "1"} className="size-5 md:size-4" /> Só os meus
        </label>
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Filtrar
        </button>
      </form>
      <Suspense>
        <SavedFilters listKey="funil" />
      </Suspense>
      {error && <Alert kind="error">{error}</Alert>}

      {/* Celular: faixa de etapas com contagem + lista da etapa escolhida, com cartões grandes para o polegar */}
      <div className="md:hidden">
        <nav aria-label="Etapas do funil" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {columns.map((c) => {
            const on = c.value === mobileStage;
            return (
              <Link
                key={c.value}
                href={`?${new URLSearchParams({ ...keep, etapa: c.value })}`}
                aria-current={on ? "page" : undefined}
                scroll={false}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm ${
                  on ? "border-navy bg-navy font-semibold text-white" : c.cards.length ? "border-line bg-white text-ink" : "border-line bg-white text-muted"
                }`}
              >
                {c.label}
                <span className={`rounded-full px-1.5 text-xs font-bold tabular-nums ${on ? "bg-white/20" : "bg-surface"}`}>{c.cards.length}</span>
              </Link>
            );
          })}
        </nav>
        <section aria-label={`Leads em ${mobile.label}`}>
          {mobile.cards.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">Nenhum lead nesta etapa.</p>
          ) : (
            <ul className="space-y-2">
              {mobile.cards.slice(0, 100).map((l) => (
                <li key={l.id}>{card(l, true)}</li>
              ))}
              {mobile.cards.length > 100 && <li className="px-1 text-xs text-muted">+ {mobile.cards.length - 100} — use a pesquisa para encontrar</li>}
            </ul>
          )}
        </section>
      </div>

      {/* Computador: quadro em colunas */}
      <div className="-mx-4 hidden overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 md:block" data-testid="funil-quadro">
        <div className="flex min-w-max items-start gap-3">
          {columns.map((s) => (
            <section key={s.value} aria-label={s.label} className="w-64 shrink-0 rounded-xl bg-surface p-2.5">
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-ink">{s.label}</h2>
                <span className="rounded-full bg-white px-2 text-xs font-bold tabular-nums text-ink">{s.cards.length}</span>
              </header>
              <ul className="space-y-2">
                {s.cards.slice(0, 60).map((l) => (
                  <li key={l.id}>{card(l)}</li>
                ))}
                {s.cards.length > 60 && <li className="px-1 text-xs text-muted">+ {s.cards.length - 60} — use o filtro para encontrar</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
