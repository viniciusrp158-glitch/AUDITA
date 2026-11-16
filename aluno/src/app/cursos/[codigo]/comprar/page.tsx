import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Zap } from "lucide-react";
import { capaDoCurso } from "@/lib/academy";
import { brl, hoursText, storeCourse, storeInfo } from "@/lib/vitrine";
import { EtapasCompra } from "../../../etapas-compra";
import { PublicPage } from "../../../loja";
import { BuyForm } from "./buy-form";

export const metadata = { title: "Comprar" };
export const dynamic = "force-dynamic";

/** Compra (Audita Academy, etapa 3): etapas no topo, dados à esquerda e resumo do pedido com a capa à direita. */
export default async function ComprarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const [r, s] = await Promise.all([storeCourse(codigo), storeInfo()]);
  const c = r?.aberta ? r.curso : null;
  if (!c || !s) notFound();
  const detalhes = [hoursText(c.workload_minutes), `${c.modules.length} módulos`, c.access_days ? `acesso por ${c.access_days} dias` : "acesso sem prazo"];
  return (
    <PublicPage>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <Link href={`/cursos/${c.code}`} className="self-start text-sm text-muted underline-offset-4 hover:text-navy hover:underline">
          ← Voltar ao curso
        </Link>
        <EtapasCompra atual={0} />
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
          <section className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-7">
            <h1 className="font-display text-2xl font-extrabold text-navy">Seus dados</h1>
            <p className="mt-1 text-sm text-muted">O acesso ao curso é liberado para este e-mail assim que o pagamento for confirmado.</p>
            <BuyForm code={c.code} requireCpf={s.require_cpf} />
          </section>
          <aside className="overflow-hidden rounded-2xl border border-line bg-white md:sticky md:top-24" data-testid="buy-summary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capaDoCurso(c.code)} alt="" className="aspect-[16/9] w-full object-cover" />
            <div className="flex flex-col gap-3 p-5">
              <p className="text-xs text-muted">Resumo do pedido · {c.code}</p>
              <p className="font-display leading-snug font-bold text-navy">{c.title}</p>
              <p className="text-sm text-muted">{detalhes.filter(Boolean).join(" · ")}</p>
              <p className="flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="font-display text-[28px] font-extrabold text-navy">{brl(c.price)}</span>
              </p>
              <ul className="flex flex-col gap-2 border-t border-line pt-3 text-[13px] leading-snug text-muted">
                <li className="flex gap-2">
                  <Lock size={16} className="mt-px shrink-0 text-green-dark" aria-hidden /> Pagamento na página segura do Mercado Pago (Pix, cartão ou boleto).
                  Os dados de pagamento não passam pela AUDITA.
                </li>
                <li className="flex gap-2">
                  <Zap size={16} className="mt-px shrink-0 text-green-dark" aria-hidden /> Acesso liberado assim que o pagamento é confirmado.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </PublicPage>
  );
}
