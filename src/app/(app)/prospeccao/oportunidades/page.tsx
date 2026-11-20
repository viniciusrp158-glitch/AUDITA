import Link from "next/link";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { getNiches } from "@/lib/prospect/queries";
import { companyDisplayName } from "@/lib/prospect/messages";
import { getOpportunities, getOpportunityCounts, GROUPS, isGroup, SIZE_CLASS_LABEL, type GroupCode } from "@/lib/prospect/opportunities";
import { OpportunityCard } from "./card";

export const metadata = { title: "Oportunidades" };

/**
 * Oportunidades do dia (AUDDOC020 Rev.01, RP-20/RP-21): a carteira já filtrada pelo público-alvo e organizada por
 * chance de resposta; uma empresa por vez (modo prospecção) e, no computador, a fila ao lado.
 */
export default async function OportunidadesPage({ searchParams }: { searchParams: Promise<{ grupo?: string; i?: string }> }) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const { counts, error: countError } = await getOpportunityCounts();
  const first = GROUPS.find((g) => counts[g.value] > 0)?.value ?? "quente";
  const group: GroupCode = isGroup(sp.grupo) ? sp.grupo : first;
  const total = counts[group];
  const i = Math.min(Math.max(0, Number(sp.i) || 0), Math.max(0, total - 1));
  const [{ rows, error }, niches] = await Promise.all([getOpportunities(group, 30, Math.floor(i / 30) * 30), getNiches()]);
  const nicheCode = new Map(niches.map((n) => [n.id, n.code]));
  const current = rows[i % 30] ?? rows[0];
  const href = (g: GroupCode, n = 0) => `?${new URLSearchParams({ grupo: g, ...(n && { i: String(n) }) })}`;
  const today = new Date().getFullYear();

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Empresas do público-alvo já analisadas e separadas pela chance de resposta. Contate, toque no resultado e siga para a próxima."
      />

      <nav aria-label="Grupos de chance" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {GROUPS.map((g) => {
          const on = g.value === group;
          return (
            <Link
              key={g.value}
              href={href(g.value)}
              aria-current={on ? "page" : undefined}
              title={g.hint}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${on ? "border-navy bg-navy font-semibold text-white" : "border-line bg-white text-ink"}`}
            >
              <span aria-hidden>{g.emoji}</span> {g.label}
              <span className={`rounded-full px-2 text-xs font-bold tabular-nums ${on ? "bg-white/20" : "bg-surface"}`}>{counts[g.value].toLocaleString("pt-BR")}</span>
            </Link>
          );
        })}
      </nav>

      {(error || countError) && (
        <div className="mb-4">
          <Alert kind="error">Não foi possível carregar as oportunidades agora. Tente de novo em instantes.</Alert>
        </div>
      )}

      {!current ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          {GROUPS.every((g) => counts[g.value] === 0)
            ? "A carteira de oportunidades ainda não foi calculada. Ela é atualizada toda noite e a cada carga da base da Receita."
            : "Nenhuma empresa neste grupo. Escolha outro grupo acima."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <OpportunityCard
            key={current.cnpj}
            userName={user.fullName.split(" ")[0]}
            position={i + 1}
            total={total}
            nextHref={i + 1 < total ? href(group, i + 1) : null}
            item={{
              cnpj: current.cnpj,
              legal_name: current.legal_name,
              trade_name: current.trade_name,
              municipality: current.municipality,
              km: current.km,
              niche_name: current.niche_name,
              niche_code: nicheCode.get(current.niche_id) ?? null,
              size_label: SIZE_CLASS_LABEL[current.size_class] ?? current.size_class,
              score: current.score,
              own_phone: current.own_phone,
              own_email: current.own_email,
              phone: current.phone,
              email: current.email,
              cnae_main: current.cnae_main,
              years: current.started_on ? today - Number(current.started_on.slice(0, 4)) : null,
              reasons: current.reasons,
              group: current.group_code,
            }}
          />
          {/* Computador: a fila do grupo ao lado, para escolher outra empresa */}
          <aside aria-label="Próximas empresas" className="hidden rounded-2xl border border-line bg-white lg:block">
            <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">Próximas do grupo</h2>
            <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {rows.map((r, k) => {
                const n = Math.floor(i / 30) * 30 + k;
                return (
                  <li key={r.cnpj}>
                    <Link href={href(group, n)} scroll={false} aria-current={n === i ? "true" : undefined} className={`flex items-center gap-2 px-4 py-2 text-sm ${n === i ? "bg-surface font-semibold" : "hover:bg-surface/60"}`}>
                      <span className="w-7 shrink-0 text-xs font-bold tabular-nums text-navy">{r.score}</span>
                      <span className="min-w-0 flex-1 truncate">{companyDisplayName(r.trade_name, r.legal_name)}</span>
                      <span className="shrink-0 text-xs text-muted">{r.km !== null ? `${Math.round(r.km)} km` : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      )}
    </>
  );
}
