import "server-only";
/** Oportunidades do dia (AUDDOC020 Rev.01, RP-20/RP-21): leitura da carteira pré-calculada, pela função do banco. */
import { createClient } from "@/lib/supabase/server";

export const GROUPS = [
  { value: "quente", label: "Quentes", emoji: "🔥", hint: "Contato próprio e perfil forte: maior chance de resposta" },
  { value: "morno", label: "Mornos", emoji: "🙂", hint: "Bom perfil; chance média de resposta" },
  { value: "frio", label: "Frios", emoji: "❄️", hint: "Perfil ou contato mais fracos" },
  { value: "precisa_contato", label: "Precisa de contato", emoji: "🔎", hint: "Só há o contato da contabilidade: pesquise o número da empresa" },
] as const;
export type GroupCode = (typeof GROUPS)[number]["value"];
export const isGroup = (v: string | undefined): v is GroupCode => GROUPS.some((g) => g.value === v);

export const SIZE_CLASS_LABEL: Record<string, string> = {
  grande: "Grande empresa",
  media: "Média empresa",
  epp: "Pequeno porte (EPP)",
  me: "Microempresa com estrutura",
};

export type Opportunity = {
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  municipality: string;
  km: number | null;
  niche_id: string;
  niche_name: string;
  size_class: string;
  group_code: GroupCode;
  score: number;
  own_phone: boolean;
  own_email: boolean;
  phone: string | null;
  email: string | null;
  cnae_main: string;
  started_on: string | null;
  capital_social: number | null;
  establishments: number | null;
  reasons: string[];
};

export async function getOpportunityCounts(): Promise<{ counts: Record<GroupCode, number>; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prospect_opportunity_counts");
  const counts = { quente: 0, morno: 0, frio: 0, precisa_contato: 0 } as Record<GroupCode, number>;
  for (const r of (data ?? []) as { group_code: GroupCode; n: number }[]) counts[r.group_code] = Number(r.n);
  if (error) console.error("prospect_opportunity_counts", error.code, error.message);
  return { counts, error: Boolean(error) };
}

export async function getOpportunities(group: GroupCode, limit: number, offset = 0): Promise<{ rows: Opportunity[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prospect_opportunities", { p_group: group, p_limit: limit, p_offset: offset });
  if (error) console.error("prospect_opportunities", error.code, error.message);
  const rows = ((data ?? []) as Opportunity[]).map((r) => ({ ...r, km: r.km === null ? null : Number(r.km), capital_social: r.capital_social === null ? null : Number(r.capital_social) }));
  return { rows, error: Boolean(error) };
}
