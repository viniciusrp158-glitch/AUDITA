import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dadosDoAluno, DocumentoFinanceiro } from "../../documento";
import { pago, type Pedido } from "../../util";

export const metadata = { title: "Comprovante" };
export const dynamic = "force-dynamic";

/** Comprovante de uma compra paga (só pedidos do próprio aluno, pela função training_my_orders). */
export default async function ComprovantePage({ params }: { params: Promise<{ pedido: string }> }) {
  const { pedido } = await params;
  const aluno = await dadosDoAluno();
  if (!aluno) redirect("/entrar");
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_my_orders");
  const p = ((data ?? []) as Pedido[]).find((x) => x.id === pedido);
  if (!p || !pago(p)) notFound();
  return <DocumentoFinanceiro titulo="Comprovante de pagamento" subtitulo={`Pedido ${p.id.slice(0, 8)}`} pedidos={[p]} aluno={aluno} />;
}
