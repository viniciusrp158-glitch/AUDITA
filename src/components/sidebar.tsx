"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Building2,
  Calculator,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Logo, Signature } from "@/components/brand";
import { signOut } from "@/app/login/actions";

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

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

      {open && <div className="fixed inset-0 z-30 bg-navy/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
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

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
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
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-sm font-medium text-ink" title={userName}>
            {userName}
          </p>
          <p className="truncate text-xs text-muted" title={userEmail}>
            {userEmail}
          </p>
          <div className="mt-3 flex items-center gap-1">
            <Link
              href="/atualizar-senha"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-navy"
            >
              <KeyRound size={16} /> Alterar senha
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
      </aside>
    </>
  );
}
