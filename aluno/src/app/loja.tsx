import Link from "next/link";
import { Menu, X } from "lucide-react";
import { formatCnpj, formatPhone, storeInfo } from "@/lib/vitrine";
import { AcademyLogo } from "./shell";

const MENU = [
  { href: "/cursos", rotulo: "Cursos" },
  { href: "/#como", rotulo: "Como funciona" },
  { href: "/#empresas", rotulo: "Para empresas" },
  { href: "/certificado", rotulo: "Verificar certificado" },
];

/** Cabeçalho das páginas públicas (vitrine, compra, termos). No celular, o menu abre num painel (sem script). */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="relative mx-auto flex min-h-[72px] max-w-6xl items-center gap-x-6 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Audita Academy, página inicial">
          <AcademyLogo variant="escura" height={44} />
        </Link>
        <nav aria-label="Principal" className="ml-auto hidden items-center gap-x-6 text-[15px] font-medium lg:flex">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="border-b-2 border-transparent py-2 text-white/85 hover:border-green hover:text-white">
              {m.rotulo}
            </Link>
          ))}
        </nav>
        <Link
          href="/entrar"
          className="ml-auto inline-flex min-h-11 items-center rounded-full bg-green px-5 font-semibold text-navy hover:bg-[#8cc912] lg:ml-0"
        >
          Entrar
        </Link>
        <details className="group lg:hidden">
          <summary
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/30 [&::-webkit-details-marker]:hidden"
            aria-label="Abrir o menu"
          >
            <Menu size={20} aria-hidden className="group-open:hidden" />
            <X size={20} aria-hidden className="hidden group-open:block" />
          </summary>
          <nav aria-label="Principal" className="absolute inset-x-0 top-full flex flex-col border-t border-white/15 bg-navy px-4 pb-4 shadow-[0_14px_28px_rgba(0,0,0,0.3)] sm:px-6">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className="flex min-h-12 items-center border-b border-white/10 text-base font-medium">
                {m.rotulo}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

/** Rodapé com o vendedor, o suporte e os textos legais. */
export async function PublicFooter() {
  const s = await storeInfo();
  return (
    <footer className="mt-auto bg-navy text-white/75">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-xs sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3">
          <AcademyLogo variant="escura" height={48} />
          <p className="text-sm text-white/80">Audita Academy é a plataforma de treinamentos da AUDITA | SSMA &amp; SGI.</p>
          <p>
            {s?.seller_name ? `${s.seller_name}` : "AUDITA | SSMA & SGI"}
            {s?.seller_document ? ` · CNPJ ${formatCnpj(s.seller_document)}` : ""}
          </p>
        </div>
        <nav aria-label="Informações" className="flex flex-wrap gap-x-4 gap-y-1">
          {s?.terms_text && (
            <Link href="/termos" className="hover:text-white">
              Termos de uso e de compra
            </Link>
          )}
          {s?.privacy_text && (
            <Link href="/privacidade" className="hover:text-white">
              Política de privacidade
            </Link>
          )}
          {s?.support_email && (
            <a href={`mailto:${s.support_email}`} className="hover:text-white">
              {s.support_email}
            </a>
          )}
          {s?.support_phone && <span>{formatPhone(s.support_phone)}</span>}
        </nav>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
