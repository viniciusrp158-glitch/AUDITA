import Link from "next/link";
import { notFound } from "next/navigation";
import { brl, storeCourse, storeInfo } from "@/lib/vitrine";
import { PublicPage } from "../../../loja";
import { BuyForm } from "./buy-form";

export const metadata = { title: "Comprar" };
export const dynamic = "force-dynamic";

export default async function ComprarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const [r, s] = await Promise.all([storeCourse(codigo), storeInfo()]);
  const c = r?.aberta ? r.curso : null;
  if (!c || !s) notFound();
  return (
    <PublicPage>
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_320px] md:items-start">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h1 className="text-2xl font-extrabold text-navy">Seus dados</h1>
          <p className="mt-1 text-sm text-muted">O acesso ao curso é liberado para este e-mail assim que o pagamento for confirmado.</p>
          <BuyForm code={c.code} requireCpf={s.require_cpf} />
        </section>
        <aside className="rounded-2xl bg-navy p-6 text-white" data-testid="buy-summary">
          <p className="text-sm text-white/70">{c.code}</p>
          <p className="mt-1 font-bold leading-snug">{c.title}</p>
          <p className="mt-4 text-3xl font-extrabold">{brl(c.price)}</p>
          <p className="mt-1 text-sm text-white/75">{c.access_days ? `Acesso por ${c.access_days} dias` : "Acesso sem prazo"}</p>
          <p className="mt-5 border-t border-white/15 pt-4 text-xs leading-relaxed text-white/70">
            Ao continuar, você vai para a página segura do Mercado Pago para pagar com Pix, cartão ou boleto. Os dados de pagamento não passam pela AUDITA.
          </p>
          <Link href={`/cursos/${c.code}`} className="mt-4 inline-block text-sm text-white/80 underline-offset-2 hover:underline">
            Voltar ao curso
          </Link>
        </aside>
      </main>
    </PublicPage>
  );
}
