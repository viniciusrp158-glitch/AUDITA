import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "./entrar/actions";
import { AcademyLogo } from "./marca";

export { AcademyLogo };

/**
 * Logotipo da AUDITA (recorte de exibição das margens brancas do PNG, como no sistema). Fica nos certificados até o
 * Diretor decidir qual marca vai no documento (planejamento da Audita Academy, 16/11/2026).
 */
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

/** Cabeçalho da área do aluno (fundo claro, como no protótipo aprovado). */
export function StudentHeader({ name }: { name?: string }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-[68px] max-w-6xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <Link href="/meus-cursos" aria-label="Audita Academy, meus cursos" className="rounded-md">
          <AcademyLogo height={40} />
        </Link>
        <span className="flex-1" />
        {name && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[16rem] truncate text-muted sm:inline">{name}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium text-ink hover:bg-surface"
              >
                <LogOut size={15} aria-hidden /> Sair
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

/** Telas de acesso (entrar, criar senha, esqueci): foto com a marca de um lado, formulário do outro. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex min-h-[188px] flex-col justify-end overflow-hidden bg-navy text-white lg:min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/treinamentos/brand/acesso.webp" alt="" className="absolute inset-0 size-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-b from-navy/50 via-navy/70 to-navy/95" aria-hidden />
        <div className="relative flex flex-col gap-4 p-5 sm:p-8 lg:p-12">
          <Link href="/cursos" aria-label="Audita Academy, cursos" className="self-start rounded-md">
            <AcademyLogo variant="escura" height={58} />
          </Link>
          <div className="hidden flex-col gap-3 lg:flex">
            <p className="font-display max-w-[18ch] text-4xl leading-tight font-extrabold text-balance">Seus cursos em um só lugar</p>
            <p className="max-w-[44ch] text-white/80">Apostilas, videoaulas, avaliações e certificados, no computador ou no celular.</p>
          </div>
        </div>
      </section>
      <section className="flex justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
