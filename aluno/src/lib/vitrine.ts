import "server-only";
import { cache } from "react";

/** Módulo na vitrine (sem material: só o que a página de venda mostra). */
export type StoreModule = {
  position: number;
  title: string;
  objective: string | null;
  video_minutes: number | null;
  reading_minutes: number | null;
  activity_minutes: number | null;
  has_video: boolean;
};
export type StoreCourse = {
  code: string;
  title: string;
  summary: string | null;
  modality: string | null;
  workload_minutes: number | null;
  audience: string | null;
  prerequisites: string | null;
  general_objective: string | null;
  methodology: string | null;
  assessment_rules: string | null;
  important_notice: string | null;
  instructor_name: string | null;
  version_label: string;
  price: number;
  access_days: number | null;
  modules: StoreModule[];
  final: { pass_score: number; objectives: number; max_attempts: number | null } | null;
};
export type StoreInfo = {
  open: boolean;
  seller_name: string | null;
  seller_document: string | null;
  support_email: string | null;
  support_phone: string | null;
  require_cpf: boolean;
  terms_text: string | null;
  privacy_text: string | null;
  terms_updated_at: string | null;
};

/**
 * Chamada à função "vitrine" com a chave publicável: visitantes nunca leem o banco direto (a função usa a chave de
 * serviço, que só existe dentro do Supabase).
 */
export async function vitrine<T>(
  acao: string,
  payload: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vitrine`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, ...extraHeaders },
      body: JSON.stringify({ acao, ...payload }),
      cache: "no-store",
    });
    const body = (await res.json()) as T & { erro?: string };
    if (!res.ok) return { error: body.erro ?? "Não foi possível concluir agora. Tente de novo." };
    return { data: body };
  } catch {
    return { error: "Não foi possível falar com o servidor. Tente de novo." };
  }
}

/**
 * Cabeçalhos que levam à função "vitrine" o IP do comprador (limite de tentativas da compra; auditoria de segurança,
 * 25/10/2026). A chamada sai do servidor da área do aluno; sem isto, todas as compras pareceriam vir do mesmo endereço.
 * VITRINE_CHAVE_INTERNA (só no servidor, nunca NEXT_PUBLIC) prova à função que o IP foi informado por este servidor.
 */
export function buyerIpHeaders(h: Headers): Record<string, string> {
  const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 100);
  const out: Record<string, string> = {};
  if (ip) out["x-audita-ip-cliente"] = ip;
  if (process.env.VITRINE_CHAVE_INTERNA) out["x-audita-vitrine-chave"] = process.env.VITRINE_CHAVE_INTERNA;
  return out;
}

export const storeInfo = cache(async () => (await vitrine<StoreInfo>("loja")).data ?? null);
export const catalog = cache(async () => (await vitrine<{ aberta: boolean; cursos: StoreCourse[] }>("catalogo")).data ?? null);
export const storeCourse = cache(async (code: string) => (await vitrine<{ aberta: boolean; curso: StoreCourse | null }>("curso", { codigo: code })).data ?? null);

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function hoursText(min: number | null | undefined): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} ${h === 1 ? "hora" : "horas"}`;
}

export function formatCnpj(v: string) {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatPhone(v: string) {
  return v.length === 11 ? v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : v.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
}
