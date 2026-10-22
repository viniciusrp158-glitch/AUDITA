import { AuthCard } from "../shell";
import { SignInForm } from "./forms";

export const metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  link: "O link é inválido ou expirou. Peça um novo em “Esqueci minha senha”.",
  saiu: "Você saiu da área do aluno.",
};

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Área do aluno" subtitle="Entre com o e-mail em que você recebeu o convite do curso.">
      <SignInForm notice={sp.motivo ? NOTICES[sp.motivo] : undefined} />
    </AuthCard>
  );
}
