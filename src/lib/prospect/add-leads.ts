import "server-only";
/**
 * Inclusão de empresas da base no funil (RP-05/RP-06): pontua pela nota explicada e grava como "Lead importado".
 * Usada pela Pesquisa (seleção em lote) e pelo modo prospecção (empresa da carteira contatada na hora).
 */
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { getNiches, getReleasedServices } from "@/lib/prospect/queries";
import { scoreCompany } from "@/lib/prospect/score";
import { createClient } from "@/lib/supabase/server";

export async function insertLeadsFromBase(cnpjs: string[]): Promise<{ added: number; skipped: number; error?: string }> {
  const supabase = await createClient();
  const [niches, released, est] = await Promise.all([
    getNiches(),
    getReleasedServices(),
    supabase
      .from("cnpj_establishments")
      .select("cnpj, legal_name, trade_name, size_code, started_on, cnae_main, cnae_secondary, ibge_code, phone1, phone2, email, publication, ibge_municipalities(km_from_base)")
      .in("cnpj", cnpjs),
  ]);
  if (est.error) return { added: 0, skipped: 0, error: "Não foi possível ler a base de empresas." };
  const today = todaySaoPaulo();
  let added = 0;
  let skipped = 0;
  for (const e of est.data ?? []) {
    const mun = Array.isArray(e.ibge_municipalities) ? e.ibge_municipalities[0] : e.ibge_municipalities;
    const km = mun?.km_from_base == null ? null : Number(mun.km_from_base);
    const s = scoreCompany(
      { cnaeMain: e.cnae_main, cnaeSecondary: e.cnae_secondary, sizeCode: e.size_code, startedOn: e.started_on, kmFromBase: km, hasPhone: !!(e.phone1 || e.phone2), hasEmail: !!e.email },
      niches,
      released.codes,
      today,
    );
    const { error } = await supabase.from("leads").insert({
      cnpj: e.cnpj,
      legal_name: e.legal_name,
      trade_name: e.trade_name,
      cnae_main: e.cnae_main,
      size_code: e.size_code,
      ibge_code: e.ibge_code,
      niche_id: s.niche?.id ?? null,
      stage: "importado",
      score: s.score,
      score_band: s.band,
      score_detail: { items: s.items },
      score_version: s.version,
      suggested_services: s.suggestedServices,
      source: "receita",
      source_publication: e.publication,
      is_test: !isProduction,
    });
    if (error) skipped += 1;
    else added += 1;
  }
  return { added, skipped };
}
