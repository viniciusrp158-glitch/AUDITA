import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { STUDENT_COOKIE } from "./cookies";

/** Cliente Supabase no servidor com a sessão do aluno (RLS aplicada). Schema padrão: `audita`. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    db: { schema: "audita" },
    cookieOptions: STUDENT_COOKIE,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de Server Component: o middleware renova a sessão.
        }
      },
    },
  });
}

export type Student = { id: string; full_name: string; email: string };

/** Aluno da sessão (ativo) ou null. Quem tem conta mas não é aluno (ex.: equipe) recebe null. */
export async function currentStudent(): Promise<Student | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_me");
  const row = Array.isArray(data) ? data[0] : null;
  return (row as Student | undefined) ?? null;
}
