"use server";

/**
 * Descadastro pelo link do e-mail de apresentação (público; exceção da regra 4 autorizada pelo Diretor em 19/11/2026).
 * Só chama audita.prospect_unsubscribe, que põe a empresa e o e-mail em "não contatar" e não devolve dados.
 */
import { createClient } from "@/lib/supabase/server";

export async function unsubscribeAction(_prev: { done?: boolean }, formData: FormData): Promise<{ done?: boolean }> {
  const token = String(formData.get("t") ?? "");
  if (/^[0-9a-f]{48}$/.test(token)) {
    const supabase = await createClient();
    await supabase.rpc("prospect_unsubscribe", { p_token: token });
  }
  // Mesma resposta sempre: o link não revela se o código existe
  return { done: true };
}
