import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Raiz: aluno com sessão vai para Meus cursos; visitante, para a vitrine. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/meus-cursos" : "/cursos");
}
