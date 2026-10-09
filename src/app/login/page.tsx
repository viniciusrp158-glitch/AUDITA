import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getAppUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

const MOTIVOS: Record<string, string> = {
  sessao: "Sua sessão expirou ou não foi iniciada. Entre novamente.",
  saida: "Você saiu do sistema.",
  link: "O link é inválido ou expirou. Solicite um novo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  if (await getAppUser()) redirect("/");
  const { motivo } = await searchParams;

  return (
    <AuthShell title="Acesso ao sistema">
      <LoginForm notice={motivo ? MOTIVOS[motivo] : undefined} />
      <div className="mt-4 text-center">
        <Link href="/recuperar-senha" className="text-sm text-navy underline-offset-2 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
    </AuthShell>
  );
}
