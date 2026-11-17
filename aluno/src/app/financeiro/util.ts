/** Apoio do Financeiro do aluno (pedidos de training_my_orders). */
export type Pedido = {
  id: string;
  created_at: string;
  paid_at: string | null;
  course_code: string;
  course_title: string;
  amount: number;
  status: "pendente" | "aprovado" | "recusado" | "cancelado" | "estornado";
  payment_method: string | null;
  pay_url: string | null;
  expired: boolean;
  refund_pending: boolean;
};

export const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
export const anoDe = (d: string) => Number(new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 4));

/** Situação do pedido como o aluno entende. */
export function situacaoPedido(p: Pedido): { rotulo: string; tom: string } {
  if (p.status === "aprovado") return p.refund_pending ? { rotulo: "Pago, em devolução", tom: "amarelo" } : { rotulo: "Pago", tom: "verde" };
  if (p.status === "pendente") return p.expired ? { rotulo: "Vencido", tom: "cinza" } : { rotulo: "Aguardando pagamento", tom: "amarelo" };
  if (p.status === "estornado") return { rotulo: "Estornado", tom: "cinza" };
  if (p.status === "cancelado") return { rotulo: "Cancelado", tom: "cinza" };
  return { rotulo: "Recusado", tom: "cinza" };
}

/** Forma de pagamento a partir do código do Mercado Pago (pix, bolbradesco, visa, master…). */
export function formaPagamento(m: string | null): string {
  if (!m) return "—";
  if (m === "pix") return "Pix";
  if (/^bol|boleto|pec/.test(m)) return "Boleto";
  if (m === "account_money") return "Saldo Mercado Pago";
  return "Cartão";
}

/** Pedido que conta como pagamento efetivo (relatório e totais). */
export const pago = (p: Pedido) => p.status === "aprovado" && !p.refund_pending && p.paid_at !== null;
