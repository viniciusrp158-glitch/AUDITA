import Link from "next/link";
import { formatCnpj, formatPhone, storeInfo } from "@/lib/vitrine";
import { AcademyLogo } from "./shell";

/** Cabeçalho das páginas públicas (vitrine, compra, termos). */
export function PublicHeader() {
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex min-h-[72px] max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/cursos" className="rounded-md" aria-label="Audita Academy, cursos">
          <AcademyLogo variant="escura" height={44} />
        </Link>
        <nav aria-label="Principal" className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] font-medium">
          <Link href="/cursos" className="text-white/85 hover:text-white">
            Cursos
          </Link>
          <Link href="/certificado" className="text-white/85 hover:text-white">
            Verificar certificado
          </Link>
          <Link href="/entrar" className="inline-flex min-h-10 items-center rounded-full bg-green px-5 font-semibold text-navy hover:bg-[#8cc912]">
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
