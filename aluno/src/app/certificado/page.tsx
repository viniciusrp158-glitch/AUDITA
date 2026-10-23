import { redirect } from "next/navigation";
import { PublicPage } from "../loja";

export const metadata = { title: "Verificar certificado" };

async function verificar(formData: FormData) {
  "use server";
  const code = String(formData.get("codigo") ?? "").trim().toUpperCase().replace(/[^0-9A-F]/g, "");
  if (code.length !== 12) redirect("/certificado?erro=1");
  redirect(`/certificado/${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`);
}

export default async function VerificarFormPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  return (
    <PublicPage>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12 sm:px-6">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-extrabold text-navy">Verificar certificado</h1>
          <p className="mt-1 text-sm text-muted">Digite o código impresso no certificado (formato XXXX-XXXX-XXXX).</p>
          <form action={verificar} className="mt-5 flex flex-col gap-3">
            {sp.erro && (
              <p role="alert" className="text-sm text-danger">
                Código incompleto. Confira os 12 caracteres.
              </p>
            )}
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Código
              <input name="codigo" required autoComplete="off" className="rounded-lg border border-line px-3 py-2.5 font-mono uppercase" placeholder="A84E-63BB-7437" />
            </label>
            <button type="submit" className="min-h-11 rounded-[10px] bg-navy px-5 text-sm font-bold text-white">
              Verificar
            </button>
          </form>
        </section>
      </main>
    </PublicPage>
  );
}
