import { AuthCard } from "../shell";
import { ResetForm } from "../entrar/forms";

export const metadata = { title: "Esqueci minha senha" };

export default function EsqueciPage() {
  return (
    <AuthCard title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma nova senha.">
      <ResetForm />
    </AuthCard>
  );
}
