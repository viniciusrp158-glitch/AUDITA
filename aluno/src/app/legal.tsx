import { notFound } from "next/navigation";
import { storeInfo } from "@/lib/vitrine";
import { PublicPage } from "./loja";

/** Termos e política de privacidade: textos cadastrados pela AUDITA na gestão (nada é escrito pelo sistema). */
export async function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const s = await storeInfo();
  const text = kind === "terms" ? s?.terms_text : s?.privacy_text;
  if (!text) notFound();
  return (
    <PublicPage>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-extrabold text-navy">{kind === "terms" ? "Termos de uso e de compra" : "Política de privacidade"}</h1>
        {s?.terms_updated_at && (
          <p className="mt-1 text-xs text-muted">Atualizado em {new Date(s.terms_updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        )}
        <div className="mt-6 text-[15px] leading-relaxed whitespace-pre-line text-ink" data-testid="legal-text">
          {text}
        </div>
      </main>
    </PublicPage>
  );
}
