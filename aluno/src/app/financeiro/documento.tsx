import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCnpj, formatPhone, storeInfo } from "@/lib/vitrine";
import { PrintButton } from "../curso/[matricula]/certificado/print-button";
import { AcademyLogo } from "../marca";
import { StudentHeader } from "../shell";
import { brl, dataBR, formaPagamento, type Pedido } from "./util";

type Aluno = {
  full_name: string;
  email: string;
  cpf: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_cep: string | null;
};

const fmtCpf = (v: string | null) => (v && v.length === 11 ? v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : null);

export async function dadosDoAluno(): Promise<Aluno | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("training_students")
    .select("full_name, email, cpf, address_street, address_number, address_complement, address_district, address_city, address_state, address_cep")
    .eq("user_id", user.id)
    .maybeSingle();
  return data as Aluno | null;
}

/**
 * Documento para imprimir ou salvar em PDF (comprovante de uma compra ou relatório anual). Dados do vendedor vêm do
 * cadastro de vendas da gestão; nada é escrito pelo sistema. Não é nota fiscal e não promete dedução no imposto de renda.
 */
export async function DocumentoFinanceiro({ titulo, subtitulo, pedidos, aluno }: { titulo: string; subtitulo: string; pedidos: Pedido[]; aluno: Aluno }) {
  const loja = await storeInfo();
  const total = pedidos.reduce((s, p) => s + Number(p.amount), 0);
  const endereco = [
    [aluno.address_street, aluno.address_number].filter(Boolean).join(", "),
    aluno.address_complement,
    aluno.address_district,
    [aluno.address_city, aluno.address_state].filter(Boolean).join(" / "),
    aluno.address_cep && `CEP ${aluno.address_cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <StudentHeader ativo="financeiro" />
      <main className="impressao-retrato mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-8 pb-28 sm:px-6 md:pb-12">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link href="/financeiro" className="text-sm text-muted underline-offset-4 hover:text-navy hover:underline">
            ← Financeiro
          </Link>
          <PrintButton rotulo="Imprimir ou salvar em PDF" />
        </div>
        <article className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-6 sm:p-10 print:rounded-none print:border-0 print:p-0" data-testid="documento-financeiro">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy pb-5">
            <AcademyLogo height={52} />
            <div className="text-right text-sm text-ink">
              <p className="font-semibold">{loja?.seller_name ?? "AUDITA | SSMA & SGI"}</p>
              {loja?.seller_document && <p>CNPJ {formatCnpj(loja.seller_document)}</p>}
              {loja?.support_email && <p>{loja.support_email}</p>}
              {loja?.support_phone && <p>{formatPhone(loja.support_phone)}</p>}
            </div>
          </header>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-navy">{titulo}</h1>
            <p className="text-sm text-muted">{subtitulo}</p>
          </div>
          <section className="grid gap-1 rounded-xl bg-surface p-4 text-sm print:bg-transparent print:p-0">
            <p>
              <span className="text-muted">Aluno: </span>
              <strong>{aluno.full_name}</strong>
            </p>
            {fmtCpf(aluno.cpf) && (
              <p>
                <span className="text-muted">CPF: </span>
                {fmtCpf(aluno.cpf)}
              </p>
            )}
            <p>
              <span className="text-muted">E-mail: </span>
              {aluno.email}
            </p>
            {endereco && (
              <p>
                <span className="text-muted">Endereço: </span>
                {endereco}
              </p>
            )}
          </section>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-xs tracking-[0.05em] text-muted uppercase">
                  <th className="py-2 pr-3 font-semibold">Data do pagamento</th>
                  <th className="py-2 pr-3 font-semibold">Curso</th>
                  <th className="py-2 pr-3 font-semibold">Forma</th>
                  <th className="py-2 pr-3 font-semibold">Pedido</th>
                  <th className="py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-b border-line">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{dataBR(p.paid_at)}</td>
                    <td className="py-2.5 pr-3">
                      {p.course_code} · {p.course_title}
                    </td>
                    <td className="py-2.5 pr-3">{formaPagamento(p.payment_method)}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{p.id.slice(0, 8)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">{brl(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 font-semibold">
                    Total pago
                  </td>
                  <td className="pt-3 text-right font-bold whitespace-nowrap">{brl(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <footer className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
            Documento emitido em {hoje} pela plataforma Audita Academy, com os pagamentos confirmados pelo Mercado Pago. Não é nota fiscal. Cursos livres.
          </footer>
        </article>
      </main>
    </>
  );
}
