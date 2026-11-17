import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dadosDoAluno, DocumentoFinanceiro } from "../documento";
import { anoDe, pago, type Pedido } from "../util";

export const metadata = { title: "Relatório de pagamentos" };
export const dynamic = "force-dynamic";

/** Relatório anual de pagamentos do aluno (pagamentos confirmados no ano, pela data do pagamento). */
export default async function RelatorioPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano: anoTxt } = await searchParams;
  const aluno = await dadosDoAluno();
  if (!aluno) redirect("/entrar");
  const anoAtual = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 4));
  const ano = /^\d{4}$/.test(anoTxt ?? "") ? Number(anoTxt) : anoAtual;
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_my_orders");
  const pedidos = ((data ?? []) as Pedido[]).filter((p) => pago(p) && anoDe(p.paid_at!) === ano).sort((a, b) => a.paid_at!.localeCompare(b.paid_at!));
  return (
    <DocumentoFinanceiro
      titulo={`Relatório de pagamentos ${ano}`}
      subtitulo={pedidos.length ? `Pagamentos confirmados de 1º/01/${ano} a 31/12/${ano}` : `Nenhum pagamento confirmado em ${ano}.`}
      pedidos={pedidos}
      aluno={aluno}
    />
  );
}
