import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre um aviso: marca como lido e leva ao link dele. O link vem do banco (só caminhos internos de /treinamentos,
 * regra da tabela), nunca da URL. Sem link ou aviso de outro aluno: volta para a lista.
 */
export async function GET(request: NextRequest) {
  // Mesmo host que o navegador usou (atrás do proxy, request.url traz o endereço interno), como em auth/confirm
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const ir = (caminho: string) => NextResponse.redirect(`${proto}://${host}/treinamentos${caminho}`);

  const id = url.searchParams.get("id") ?? "";
  if (!uuidRe.test(id)) return ir("/notificacoes");
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_my_notifications", { p_limit: 200 });
  const aviso = ((data ?? []) as { id: string | null; link: string | null }[]).find((a) => a.id === id);
  if (!aviso) return ir("/notificacoes");
  await supabase.rpc("training_mark_notifications_read", { p_ids: [id] });
  return ir(aviso.link && /^\/[A-Za-z0-9]/.test(aviso.link) ? aviso.link : "/notificacoes");
}
