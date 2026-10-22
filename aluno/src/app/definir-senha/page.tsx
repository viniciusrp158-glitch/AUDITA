import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "../shell";
import { NewPasswordForm } from "../entrar/forms";

export const metadata = { title: "Criar senha" };

export default async function DefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?motivo=link");
  return (
    <AuthCard title="Crie sua senha" subtitle={`Conta: ${user.email}. Depois é só entrar com este e-mail e a nova senha.`}>
      <NewPasswordForm />
    </AuthCard>
  );
}
