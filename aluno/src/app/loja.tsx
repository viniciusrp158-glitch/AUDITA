import Link from "next/link";
import { formatCnpj, formatPhone, storeInfo } from "@/lib/vitrine";
import { Logo } from "./shell";

/** Cabeçalho das páginas públicas (vitrine, compra, termos). */
export function PublicHeader() {
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/cursos" className="flex items-center gap-3" aria-label="Cursos AUDITA">
          <span className="rounded-md bg-white px-2.5 py-1.5">
            <Logo width={88} />
          </span>
          <span className="border-l border-white/20 pl-3 text-sm text-white/80">Cursos</span>
        </Link>
        <nav aria-label="Principal" className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Link href="/cursos" className="text-white/85 hover:text-white">
            Cursos
          </Link>
          <Link href="/certificado" className="text-white/85 hover:text-white">
            Verificar certificado
          </Link>
          <Link href="/entrar" className="rounded-md border border-white/25 px-3 py-1.5 font-semibold text-white hover:bg-white/10">
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Rodapé com o vendedor, o suporte e os textos legais. */
export async function PublicFooter() {
  const s = await storeInfo();
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          {s?.seller_name ? `${s.seller_name}` : "AUDITA | SSMA & SGI"}
          {s?.seller_document ? ` · CNPJ ${formatCnpj(s.seller_document)}` : ""}
        </p>
        <nav aria-label="Informações" className="flex flex-wrap gap-x-4 gap-y-1">
          {s?.terms_text && (
            <Link href="/termos" className="hover:text-navy">
              Termos de uso e de compra
            </Link>
          )}
          {s?.privacy_text && (
            <Link href="/privacidade" className="hover:text-navy">
              Política de privacidade
            </Link>
          )}
          {s?.support_email && (
            <a href={`mailto:${s.support_email}`} className="hover:text-navy">
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
