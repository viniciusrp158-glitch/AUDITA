import { EnvBadge, Logo, Signature } from "@/components/brand";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <EnvBadge />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
            {/* Logo sobre fundo branco, como no arquivo oficial (AUDDOC003) */}
            <div className="mb-6 flex flex-col items-center gap-1 border-b border-line pb-5">
              <Logo width={168} />
              <Signature />
            </div>
            <h1 className="mb-5 text-lg font-semibold text-ink">{title}</h1>
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Gestão inteligente para ambientes mais seguros.
          </p>
        </div>
      </main>
    </div>
  );
}
