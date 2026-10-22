import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "./entrar/actions";

/** Logotipo oficial (recorte de exibição das margens brancas do PNG, como no sistema). */
export function Logo({ width = 112 }: { width?: number }) {
  const crop = { x: 190, y: 215, w: 1520, h: 530 };
  const s = width / crop.w;
  return (
    <span className="relative inline-block shrink-0 overflow-hidden" style={{ width, height: Math.round(crop.h * s) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/treinamentos/brand/audita-logo.png"
        alt="AUDITA"
        style={{ position: "absolute", maxWidth: "none", width: Math.round(1920 * s), height: Math.round(1080 * s), left: -Math.round(crop.x * s), top: -Math.round(crop.y * s) }}
      />
    </span>
  );
}

/** Cabeçalho da área do aluno. */
export function StudentHeader({ name }: { name?: string }) {
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/meus-cursos" className="flex items-center gap-3" aria-label="Meus cursos">
          <span className="rounded-md bg-white px-2.5 py-1.5"><Logo width={88} /></span>
          <span className="border-l border-white/20 pl-3 text-sm text-white/80">Treinamentos</span>
        </Link>
        <span className="flex-1" />
        {name && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[16rem] truncate text-white/80 sm:inline">{name}</span>
            <form action={signOut}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10">
                <LogOut size={15} aria-hidden /> Sair
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

/** Moldura das telas de acesso (entrar, criar senha, esqueci). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo width={150} />
          <span className="text-xs tracking-wide text-muted">AUDITA | SSMA &amp; SGI · Treinamentos</span>
        </div>
        <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
