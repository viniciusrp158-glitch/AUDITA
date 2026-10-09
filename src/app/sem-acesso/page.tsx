import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Acesso não autorizado" };

export default function SemAcessoPage() {
  return (
    <AuthShell title="Acesso não autorizado">
      <p className="text-sm leading-relaxed text-ink">
        Sua conta não está autorizada a usar o sistema AUDITA. Se você acredita que isso é um engano, fale com
        o administrador.
      </p>
      <p className="mt-3 text-xs text-muted">A tentativa foi registrada.</p>
      <div className="mt-5 text-center">
        <Link href="/login" className="text-sm text-navy underline-offset-2 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </AuthShell>
  );
}
