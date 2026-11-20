import { AuthShell } from "@/components/auth-shell";
import { UnsubscribeForm } from "./form";

export const metadata = { title: "Descadastro", robots: { index: false, follow: false } };

/** Página pública do link "Não quero receber mais e-mails" (confirmação com um toque, à prova de leitores automáticos). */
export default async function DescadastroPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <AuthShell title="Descadastro">
      <UnsubscribeForm token={String(t ?? "").slice(0, 64)} />
      <p className="mt-6 text-xs text-muted">
        Usamos apenas dados públicos de empresas (Receita Federal), conforme a LGPD. Dúvidas: engenharia.audita@outlook.com ·{" "}
        <a href="https://audita.seg.br/privacidade" className="underline">
          privacidade
        </a>
        .
      </p>
    </AuthShell>
  );
}
