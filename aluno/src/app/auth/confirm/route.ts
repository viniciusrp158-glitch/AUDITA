import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Retorno dos links enviados por e-mail: convite do aluno (token_hash + type=invite) e nova senha (code, PKCE).
 * Conferido o link, o aluno vai criar a senha.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/definir-senha";
  const supabase = await createClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  // Endereço completo com o prefixo /treinamentos, no MESMO host que o navegador usou (atrás do proxy, request.url traz
  // o endereço interno do servidor; o cookie da sessão recém-criada só vale no host público)
  const target = ok ? (type === "invite" ? "/definir-senha" : safeNext) : "/entrar?motivo=link";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return NextResponse.redirect(`${proto}://${host}/treinamentos${target}`);
}
