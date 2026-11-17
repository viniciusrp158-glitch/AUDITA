import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AreaAluno } from "../shell";
import { anoDe, brl, dataBR, formaPagamento, pago, situacaoPedido, type Pedido } from "./util";

export const metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

const TOM: Record<string, string> = { verde: "bg-ok/10 text-ok", amarelo: "bg-late-50 text-warn", cinza: "bg-surface text-muted" };

/** Financeiro (Audita Academy, etapa 6): compras, comprovantes e relatório anual de pagamentos. */
export default async function FinanceiroPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_my_orders");
  const pedidos = (data ?? []) as Pedido[];
  const pagos = pedidos.filter(pago);
  const anos = Array.from(new Set(pagos.map((p) => anoDe(p.paid_at!)))).sort((a, b) => b - a);
  const total = pagos.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <AreaAluno ativo="financeiro" largura="max-w-4xl">
      <div>
        <h1 className="font-display text-[28px] leading-tight font-extrabold text-navy">Financeiro</h1>
        <p className="mt-1 text-sm text-muted">Suas compras na Audita Academy, com comprovante e relatório anual.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end rounded-2xl border border-line bg-white p-5 sm:p-6" aria-labelledby="relatorio">
        <div>
          <h2 id="relatorio" className="font-display text-lg font-bold text-navy">
            Relatório de pagamentos
          </h2>
          <p className="mt-1 text-sm text-muted">Documento com os dados da AUDITA, os seus dados e todos os pagamentos do ano, para guardar ou apresentar.</p>
        </div>
        {anos.length ? (
          <form action="/treinamentos/financeiro/relatorio" method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Ano
              <select name="ano" defaultValue={anos[0]} className="min-h-12 rounded-[10px] border-[1.5px] border-line bg-white px-3.5 text-base">
                {anos.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-5 text-[15px] font-semibold text-white hover:bg-navy-700">
              <FileText size={17} aria-hidden /> Gerar relatório
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Disponível depois do primeiro pagamento aprovado.</p>
        )}
      </section>

      <section aria-labelledby="compras" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="compras" className="font-display text-xl font-bold text-navy">
            Minhas compras
          </h2>
          {pagos.length > 0 && <p className="text-sm text-muted">Total pago: {brl(total)}</p>}
        </div>
        {pedidos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            Nenhuma compra pela plataforma. Matrículas feitas pela sua empresa ou pela AUDITA não aparecem aqui.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="compras">
            {pedidos.map((p) => {
              const s = situacaoPedido(p);
              return (
                <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOM[s.tom]}`}>{s.rotulo}</span>
                      <span className="text-xs text-muted">Pedido {p.id.slice(0, 8)}</span>
                    </p>
                    <p className="font-semibold text-ink">{p.course_title}</p>
                    <p className="text-sm text-muted">
                      {[`Pedido em ${dataBR(p.created_at)}`, p.paid_at && `pago em ${dataBR(p.paid_at)}`, p.payment_method && formaPagamento(p.payment_method)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                    <span className="font-display text-xl font-extrabold text-navy tabular-nums">{brl(p.amount)}</span>
                    {p.pay_url ? (
                      <a href={p.pay_url} className="inline-flex min-h-11 items-center rounded-full bg-green px-5 text-sm font-semibold text-navy hover:bg-[#8cc912]">
                        Pagar agora
                      </a>
                    ) : pago(p) ? (
                      <Link href={`/financeiro/comprovante/${p.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink hover:border-navy">
                        Comprovante
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AreaAluno>
  );
}
