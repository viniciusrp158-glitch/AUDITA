import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_SESSION_COOKIE, STAFF_COOKIE } from "./cookies";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/auth/confirm", "/sem-acesso", "/cadastro"];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Renova a sessão a cada requisição e redireciona para o login quando não houver usuário. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: STAFF_COOKIE,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valida o token no servidor de autenticação (não confia apenas no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("motivo", "sessao");
    return expireLegacySession(request, NextResponse.redirect(url));
  }

  return expireLegacySession(request, response);
}

/**
 * Apaga do navegador a sessão no formato antigo (cookie sb-*-auth-token em path=/, legível por script), se ainda
 * existir (auditoria de segurança, 25/10/2026).
 */
function expireLegacySession(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (LEGACY_SESSION_COOKIE.test(name)) response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
