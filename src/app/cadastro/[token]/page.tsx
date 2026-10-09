import { Clock, ShieldCheck } from "lucide-react";
import { EnvBadge, Logo, Signature } from "@/components/brand";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RegistrationForm } from "./registration-form";

export const metadata = { title: "Cadastro de cliente", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Ctx = { status: string; expires_at: string | null; terms_version: string | null; terms_title: string | null; terms_body: string | null };

const MESSAGES: Record<string, { title: string; text: string }> = {
  utilizado: { title: "Cadastro já enviado", text: "Este link já foi utilizado. Se precisar corrigir alguma informação, fale com a AUDITA." },
  expirado: { title: "Link expirado", text: "Este link era válido por 24 horas e expirou. Solicite um novo link à AUDITA." },
  cancelado: { title: "Link cancelado", text: "Este link foi cancelado. Solicite um novo link à AUDITA." },
  invalido: { title: "Link inválido", text: "Não foi possível abrir este cadastro. Confira se o link foi copiado por completo ou solicite um novo à AUDITA." },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <EnvBadge />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Logo width={120} />
          <Signature />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-line bg-white px-4 py-4 text-center text-xs text-muted">
        AUDITA | SSMA &amp; SGI · Gestão inteligente para ambientes mais seguros. · engenharia.audita@outlook.com
      </footer>
    </div>
  );
}

export default async function CadastroPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_context", { p_token: token });
  const ctx = ((data as Ctx[] | null) ?? [])[0] ?? { status: "invalido" };

  if (ctx.status !== "valido") {
    const m = MESSAGES[ctx.status] ?? MESSAGES.invalido;
    return (
      <Shell>
        <div className="rounded-xl border border-line bg-white p-6 text-center">
          <h1 className="text-xl font-semibold text-ink">{m.title}</h1>
          <p className="mt-2 text-sm text-muted">{m.text}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Cadastro de cliente</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        Preencha os dados da sua empresa para agilizar o atendimento da AUDITA. As informações serão analisadas pela
        nossa equipe antes de efetivar o cadastro.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={14} /> Link válido até {ctx.expires_at ? formatDateTime(ctx.expires_at) : "—"}, para um único envio.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} /> Conexão segura. Campos com * são obrigatórios.
        </span>
      </div>
      <div className="mt-6">
        <RegistrationForm
          token={token}
          termsVersion={ctx.terms_version ?? ""}
          termsTitle={ctx.terms_title ?? "Termo"}
          termsBody={ctx.terms_body ?? ""}
        />
      </div>
    </Shell>
  );
}
