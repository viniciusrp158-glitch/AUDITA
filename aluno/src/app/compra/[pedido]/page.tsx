import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { brl, vitrine } from "@/lib/vitrine";
import { PublicPage } from "../../loja";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Seu pedido" };
export const dynamic = "force-dynamic";

type Pedido = {
  encontrado: boolean;
  status?: "pendente" | "aprovado" | "recusado" | "cancelado" | "estornado";
  code?: string;
  title?: string;
  amount?: number;
  email?: string;
  enrolled?: boolean;
  /** Pendente e vencido (o pedido vale 3 dias; o Mercado Pago não aceita pagar depois). */
  expired?: boolean;
  /** Pago, mas o acesso não pôde ser liberado automaticamente: a AUDITA devolve o valor. */
  manual_refund?: boolean;
};

/** Retorno do Mercado Pago: situação do pedido (o acesso é liberado pelo aviso de pagamento, não por esta página). */
export default async function PedidoPage({ params, searchParams }: { params: Promise<{ pedido: string }>; searchParams: Promise<{ t?: string }> }) {
  const { pedido } = await params;
  const { t } = await searchParams;
  const r = (await vitrine<Pedido>("pedido", { pedido, token: t ?? "" })).data;
  const p = r?.encontrado ? r : null;
  const expired = p?.status === "pendente" && Boolean(p.expired);
  const refundPending = p?.status === "aprovado" && Boolean(p.manual_refund);
  const waiting = (p?.status === "pendente" && !expired) || (p?.status === "aprovado" && !p.enrolled && !refundPending);

  return (
    <PublicPage>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8" data-testid="order-status">
          {!p ? (
            <>
              <h1 className="text-xl font-extrabold text-navy">Pedido não encontrado</h1>
              <p className="mt-2 text-sm text-muted">Use o link que o Mercado Pago mostrou ao final do pagamento.</p>
            </>
          ) : expired ? (
            <>
              <p className="flex items-center gap-2 text-xl font-extrabold text-navy">
                <Clock size={24} className="text-muted" aria-hidden /> Pedido vencido
              </p>
              <p className="mt-2 text-sm text-muted">Este pedido não foi pago no prazo de 3 dias e não pode mais ser pago. Nenhum valor foi cobrado.</p>
              {p.code && (
                <Link href={`/cursos/${p.code}/comprar`} className="mt-5 inline-flex min-h-12 items-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold text-navy">
                  Fazer novo pedido
                </Link>
              )}
            </>
          ) : refundPending ? (
            <>
              <p className="flex items-center gap-2 text-xl font-extrabold text-navy">
                <XCircle size={24} className="text-warn" aria-hidden /> Pagamento recebido, acesso não liberado
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                Não foi possível liberar o acesso automaticamente (por exemplo, o curso saiu de venda ou este e-mail já tinha acesso a ele). A AUDITA vai
                devolver o valor pelo Mercado Pago e entrar em contato pelo e-mail <strong>{p.email}</strong>.
              </p>
            </>
          ) : waiting ? (
            <>
              <AutoRefresh seconds={5} />
              <p className="flex items-center gap-2 text-xl font-extrabold text-navy">
                <Clock size={24} className="text-warn" aria-hidden /> Aguardando a confirmação do pagamento
              </p>
              <p className="mt-2 text-sm text-muted">
                Esta página se atualiza sozinha. No Pix a confirmação costuma ser imediata; no boleto, pode levar alguns dias úteis. Quando o pagamento for
                confirmado, enviamos um e-mail para <strong className="text-ink">{p.email}</strong>.
              </p>
            </>
          ) : p.status === "aprovado" ? (
            <>
              <p className="flex items-center gap-2 text-xl font-extrabold text-ok">
                <CheckCircle2 size={24} aria-hidden /> Pagamento aprovado
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                Seu acesso ao <strong>{p.title}</strong> está liberado. Enviamos para <strong>{p.email}</strong> o e-mail “Seu acesso aos treinamentos AUDITA”
                com o botão para criar sua senha. Se você já tem senha na área do aluno, é só entrar.
              </p>
              <Link href="/entrar" className="mt-5 inline-flex min-h-12 items-center rounded-[10px] bg-navy px-5 text-[15px] font-bold text-white">
                Entrar na área do aluno
              </Link>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-xl font-extrabold text-danger">
                <XCircle size={24} aria-hidden /> {p.status === "estornado" ? "Pagamento estornado" : "Pagamento não aprovado"}
              </p>
              <p className="mt-2 text-sm text-muted">
                {p.status === "estornado" ? "O valor foi devolvido e o acesso ao curso foi suspenso." : "Nenhum valor foi cobrado por este pedido. Você pode tentar de novo."}
              </p>
              {p.status !== "estornado" && p.code && (
                <Link href={`/cursos/${p.code}/comprar`} className="mt-5 inline-flex min-h-12 items-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold text-navy">
                  Tentar de novo
                </Link>
              )}
            </>
          )}
          {p?.amount && (
            <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
              Pedido {pedido.slice(0, 8)} · {p.code} · {brl(Number(p.amount))}
            </p>
          )}
        </section>
      </main>
    </PublicPage>
  );
}
