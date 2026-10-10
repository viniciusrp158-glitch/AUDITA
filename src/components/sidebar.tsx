"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Building2,
  Calculator,
  ClipboardList,
  Crown,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { Logo, Signature } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/login/actions";
import { NAV_ROLES, ROLE_LABEL, type Role } from "@/lib/permissions";

export const NAV = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/demandas", label: "Demandas", icon: ClipboardList },
  { href: "/orcamentos", label: "Orçamentos", icon: Calculator },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/comunicacao", label: "Comunicação", icon: Megaphone },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  userName,
  userEmail,
  role,
  isMaster,
  theme,
  badges = {},
}: {
  userName: string;
  userEmail: string;
  role: Role;
  isMaster: boolean;
  theme: "claro" | "escuro";
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => NAV_ROLES[n.href]?.includes(role));

  return (
    <>
      {/* Barra superior no celular */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <Logo width={104} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="rounded-md p-2 text-navy hover:bg-surface"
        >
          <Menu size={22} />
        </button>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menu principal"
      >
        <div className="flex items-start justify-between px-5 pb-4 pt-6">
          <div className="flex flex-col gap-1">
            <Logo width={128} />
            <Signature />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-md p-1 text-muted hover:bg-surface lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-navy font-semibold text-white" : "text-ink hover:bg-surface"
                }`}
              >
                <Icon size={18} className={active ? "text-green" : "text-muted group-hover:text-navy"} />
                <span className="flex-1">{label}</span>
                {(badges[href] ?? 0) > 0 && (
                  <span
                    className="rounded-full bg-warn px-1.5 text-xs font-bold text-white"
                    title={`${badges[href]} solicitação(ões) de cadastro pendente(s)`}
                  >
                    {badges[href]}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-5 py-4" data-testid="user-box">
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
          <div className="mt-3 flex items-center gap-1">
            <Link
              href="/conta"
              onClick={() => setOpen(false)}
              aria-current={isActive(pathname, "/conta") ? "page" : undefined}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-navy"
            >
              <UserRound size={16} /> Minha conta
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-navy"
              >
                <LogOut size={16} /> Sair
              </button>
            </form>
          </div>
        </div>
        <ThemeToggle initial={theme} />
      </aside>
    </>
  );
}
