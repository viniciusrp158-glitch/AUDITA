"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  Calculator,
  ClipboardList,
  Crown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  UserRound,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo, Signature } from "@/components/brand";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/login/actions";
import { NAV_ROLES, ROLE_LABEL, type Role } from "@/lib/permissions";

type Item = { href: string; label: string; icon: LucideIcon; short?: string };

/** Menu por área (Frente A, A3): Comercial, Operação e Gestão. Serviços em execução e Caixa, antes escondidos dentro
 *  de Demandas e do Início, ganham item próprio. Cada item só aparece para o nível que tem acesso (NAV_ROLES). */
export const NAV_GROUPS: { title: string | null; items: Item[] }[] = [
  { title: null, items: [{ href: "/", label: "Início", icon: LayoutDashboard }] },
  {
    title: "Comercial",
    items: [
      { href: "/prospeccao", label: "Prospecção", icon: Target },
      { href: "/clientes", label: "Clientes", icon: Building2 },
      { href: "/demandas", label: "Demandas", icon: ClipboardList },
      { href: "/orcamentos", label: "Orçamentos", icon: Calculator },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/demandas/servicos", label: "Serviços em execução", icon: Wrench, short: "Serviços" },
      { href: "/treinamentos", label: "Audita Academy", icon: GraduationCap },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/caixa", label: "Caixa", icon: Wallet },
      { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];
export const NAV: Item[] = NAV_GROUPS.flatMap((g) => g.items);

/** Atalhos da barra inferior no celular (A10), na ordem de preferência; entram os 4 primeiros que o nível acessa. */
const BOTTOM = ["/", "/prospeccao", "/clientes", "/demandas", "/orcamentos"];

/** O item ativo é o de endereço mais longo que contém a página (Serviços em execução ganha de Demandas). */
function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const h of hrefs) {
    const hit = h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`);
    if (hit && (!best || h.length > best.length)) best = h;
  }
  return best;
}

export function Sidebar({
  userName,
  userEmail,
  role,
  isMaster,
  theme,
  badges = {},
  badgeTitles = {},
}: {
  userName: string;
  userEmail: string;
  role: Role;
  isMaster: boolean;
  theme: "claro" | "escuro";
  badges?: Record<string, number>;
  /** Texto de ajuda de cada selo (ao passar o mouse). */
  badgeTitles?: Record<string, string>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const can = (href: string) => NAV_ROLES[href]?.includes(role);
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.href)) })).filter((g) => g.items.length);
  const all = groups.flatMap((g) => g.items);
  const active = activeHref(pathname, all.map((i) => i.href).concat("/conta"));
  const bottom = BOTTOM.filter(can).slice(0, 4).map((h) => all.find((i) => i.href === h)!);

  // Fecha o menu do celular ao trocar de página (inclusive pelo voltar do navegador)
  useEffect(() => setOpen(false), [pathname]);

  const badge = (href: string) =>
    (badges[href] ?? 0) > 0 && (
      <span className="rounded-full bg-warn px-1.5 text-xs font-bold text-white" title={badgeTitles[href] ?? String(badges[href])}>
        {badges[href]}
      </span>
    );

  return (
    <>
      {/* Barra superior no celular */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-2.5 lg:hidden">
        <Logo width={104} />
        <div className="flex items-center gap-1">
          <GlobalSearch compact />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open}
            className="rounded-md p-2.5 text-navy hover:bg-surface"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menu principal"
      >
        <div className="flex items-start justify-between px-5 pb-3 pt-5">
          <div className="flex flex-col gap-1">
            <Logo width={128} />
            <Signature />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-md p-2 text-muted hover:bg-surface lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="hidden px-3 pb-2 lg:block">
          <GlobalSearch />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {groups.map((g) => (
            <div key={g.title ?? "inicio"} className={g.title ? "mt-3" : ""}>
              {g.title && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>}
              <div className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const on = active === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={on ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition lg:py-1.5 ${
                        on ? "bg-navy font-semibold text-white" : "text-ink hover:bg-surface"
                      }`}
                    >
                      <Icon size={18} className={on ? "text-green" : "text-muted group-hover:text-navy"} />
                      <span className="flex-1">{label}</span>
                      {badge(href)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-5 py-3" data-testid="user-box">
          <p className="truncate text-sm font-semibold text-ink" title={userName}>
            {userName}
          </p>
          <p className="truncate text-xs text-muted" title={userEmail}>
            {userEmail}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted">
            {isMaster && <Crown size={12} className="text-green-dark" aria-hidden />}
            {isMaster ? "Usuário mestre" : ROLE_LABEL[role]}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <Link
              href="/conta"
              onClick={() => setOpen(false)}
              aria-current={active === "/conta" ? "page" : undefined}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface hover:text-navy"
            >
              <UserRound size={16} /> Minha conta
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface hover:text-navy"
              >
                <LogOut size={16} /> Sair
              </button>
            </form>
          </div>
        </div>
        <ThemeToggle initial={theme} />
      </aside>

      {/* Barra inferior no celular (A10): os atalhos mais usados ao alcance do polegar e o menu completo */}
      <nav
        aria-label="Atalhos"
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}
      >
        {bottom.map(({ href, label, short, icon: Icon }) => {
          const on = active === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] ${on ? "font-semibold text-navy" : "text-muted"}`}
            >
              <Icon size={20} className={on ? "text-green-dark" : ""} />
              <span className="max-w-full truncate">{short ?? label}</span>
              {(badges[href] ?? 0) > 0 && <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-warn" aria-hidden />}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] text-muted">
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
