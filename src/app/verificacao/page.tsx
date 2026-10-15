import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { MfaVerifyLogin } from "@/components/mfa-forms";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Verificação em duas etapas" };

/** Segunda etapa do login para quem ativou a verificação em duas etapas (caderno I3.01). */
export default async function VerificacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?motivo=sessao");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") redirect("/");
  return (
    <AuthShell title="Verificação em duas etapas">
      <p className="mb-4 text-sm text-muted">Abra o aplicativo autenticador no celular e digite o código de 6 números.</p>
      <MfaVerifyLogin />
      <form action={signOut} className="mt-4 text-center">
        <button type="submit" className="text-sm text-navy underline-offset-2 hover:underline">
          Sair
        </button>
      </form>
    </AuthShell>
  );
}
