import "server-only";
import { cookies } from "next/headers";

/** Tema da interface (claro/escuro). Guardado na conta do usuário e num cookie para a página já abrir no tema certo. */
export type Theme = "claro" | "escuro";
export const THEME_COOKIE = "audita_tema";

export async function getThemeCookie(): Promise<Theme> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "escuro" ? "escuro" : "claro";
}

export async function setThemeCookie(theme: Theme) {
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
