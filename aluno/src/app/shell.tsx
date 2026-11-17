import Link from "next/link";
import { Bell, BookOpen, ChevronDown, History, House, LogOut, MessageCircle, Receipt, UserRound } from "lucide-react";
import { whatsapp } from "@/lib/academy";
import { createClient, currentStudent } from "@/lib/supabase/server";
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

const iniciais = (nome: string) =>
  nome
    .replace(/\[.*?\]/g, "")
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "A";

/** Avisos não lidos do aluno da sessão (0 se a função não responder). */
async function naoLidos(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_unread_notifications");
  return typeof data === "number" ? data : 0;
}

type Aba = "inicio" | "historico" | "avisos" | "perfil" | "financeiro";

/**
 * Topo da área do aluno (Audita Academy, etapa 5): logo, atalhos, sino de avisos e o menu do aluno, que abre ao tocar
 * nas iniciais (Meus cursos, Histórico, Financeiro, Notificações, Meu Perfil, WhatsApp e Sair). No celular, uma barra
 * inferior leva às telas mais usadas.
 */
export async function StudentHeader({ ativo }: { name?: string; ativo?: Aba } = {}) {
  const student = await currentStudent();
  const avisos = student ? await naoLidos() : 0;
  const nome = student?.full_name ?? "";
  const itens = [
    { href: "/meus-cursos", rotulo: "Meus cursos", Icone: BookOpen },
    { href: "/historico", rotulo: "Histórico de cursos", Icone: History },
    { href: "/financeiro", rotulo: "Financeiro", Icone: Receipt },
    { href: "/notificacoes", rotulo: "Notificações", Icone: Bell, extra: avisos },
    { href: "/perfil", rotulo: "Meu Perfil", Icone: UserRound },
  ];
  const atalhos: { href: string; rotulo: string; aba: Aba }[] = [
    { href: "/meus-cursos", rotulo: "Início", aba: "inicio" },
    { href: "/historico", rotulo: "Histórico", aba: "historico" },
    { href: "/cursos", rotulo: "Catálogo", aba: "inicio" },
  ];
  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex min-h-[68px] max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
          <Link href="/meus-cursos" aria-label="Audita Academy, meus cursos" className="rounded-md">
            <AcademyLogo height={40} />
          </Link>
          {student && (
            <nav aria-label="Atalhos" className="ml-4 hidden gap-1 md:flex">
              {atalhos.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`rounded-lg px-3 py-2 text-[15px] font-medium ${a.href !== "/cursos" && ativo === a.aba ? "bg-lime-50 text-green-dark" : "text-ink hover:bg-surface"}`}
                >
                  {a.rotulo}
                </Link>
              ))}
            </nav>
          )}
          <span className="flex-1" />
          {student ? (
            <>
              <Link
                href="/notificacoes"
                className="relative grid size-11 place-items-center rounded-full border border-line text-ink hover:bg-surface"
                aria-label={avisos ? `Notificações, ${avisos} não ${avisos === 1 ? "lida" : "lidas"}` : "Notificações"}
                data-testid="bell"
              >
                <Bell size={19} aria-hidden />
                {avisos > 0 && (
                  <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
                    {avisos > 99 ? "99+" : avisos}
                  </span>
                )}
              </Link>
              <details className="group relative">
                <summary
                  className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 hover:bg-surface [&::-webkit-details-marker]:hidden"
                  aria-label="Abrir o menu do aluno"
                  data-testid="menu-aluno"
                >
                  <span className="font-display grid size-9 place-items-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden>
                    {iniciais(nome)}
                  </span>
                  <ChevronDown size={16} className="text-muted transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[290px] max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-white p-2 shadow-[0_14px_32px_rgba(3,27,53,0.16)]">
                  <div className="border-b border-line px-3 pt-2 pb-3">
                    <p className="truncate font-semibold text-ink">{nome}</p>
                    <p className="truncate text-xs text-muted">{student.email}</p>
                  </div>
                  <nav aria-label="Menu do aluno" className="flex flex-col py-1">
                    {itens.map((i) => (
                      <Link key={i.href} href={i.href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] text-ink hover:bg-surface">
                        <i.Icone size={18} className="text-green-dark" aria-hidden /> <span className="flex-1">{i.rotulo}</span>
                        {i.extra ? <span className="rounded-full bg-danger px-2 text-xs font-bold text-white">{i.extra}</span> : null}
                      </Link>
                    ))}
                    <a
                      href={whatsapp(`Olá! Sou aluno(a) da Audita Academy (${nome}) e preciso de ajuda.`)}
                      target="_blank"
                      rel="noopener"
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] text-ink hover:bg-surface"
                    >
                      <MessageCircle size={18} className="text-green-dark" aria-hidden /> Falar no WhatsApp
                    </a>
                  </nav>
                  <form action={signOut} className="border-t border-line pt-1">
                    <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[15px] text-muted hover:bg-surface">
                      <LogOut size={18} aria-hidden /> Sair
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium text-ink hover:bg-surface">
                <LogOut size={15} aria-hidden /> Sair
              </button>
            </form>
          )}
        </div>
      </header>
      {student && (
        <nav
          aria-label="Atalhos do aluno"
          className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white px-2 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] md:hidden"
        >
          {[
            { href: "/meus-cursos", rotulo: "Início", Icone: House, aba: "inicio" },
            { href: "/historico", rotulo: "Histórico", Icone: History, aba: "historico" },
            { href: "/notificacoes", rotulo: "Avisos", Icone: Bell, aba: "avisos" },
            { href: "/perfil", rotulo: "Perfil", Icone: UserRound, aba: "perfil" },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs font-medium ${ativo === t.aba ? "text-green-dark" : "text-muted"}`}
            >
              <t.Icone size={20} aria-hidden />
              {t.rotulo}
              {t.aba === "avisos" && avisos > 0 && <span className="absolute top-1 right-[calc(50%-18px)] size-2.5 rounded-full bg-danger" aria-hidden />}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

/** Moldura das páginas do aluno: topo, conteúdo e espaço para a barra inferior no celular. */
export async function AreaAluno({ ativo, children, largura = "max-w-6xl" }: { ativo?: Aba; children: React.ReactNode; largura?: string }) {
  return (
    <>
      <StudentHeader ativo={ativo} />
      <main className={`impressao-retrato mx-auto flex ${largura} flex-col gap-6 px-4 pt-8 pb-28 sm:px-6 md:pb-12`}>{children}</main>
    </>
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
          <Link href="/" aria-label="Audita Academy, página inicial" className="self-start rounded-md">
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
