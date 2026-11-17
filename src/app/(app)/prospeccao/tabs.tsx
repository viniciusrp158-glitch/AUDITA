"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/prospeccao", label: "Painel" },
  { href: "/prospeccao/pesquisar", label: "Pesquisar" },
  { href: "/prospeccao/regioes", label: "Regiões" },
  { href: "/prospeccao/funil", label: "Funil" },
  { href: "/prospeccao/nichos", label: "Nichos e palavras-chave" },
];

export function ProspectTabs() {
  const pathname = usePathname().replace(/^\/empresa/, "");
  const active = (href: string) =>
    href === "/prospeccao" ? pathname === "/prospeccao" : pathname === href || pathname.startsWith(`${href}/`) || (href === "/prospeccao/funil" && pathname.startsWith("/prospeccao/leads"));
  return (
    <nav aria-label="Seções da prospecção" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active(t.href) ? "page" : undefined}
          className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm transition ${
            active(t.href) ? "border-green font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
