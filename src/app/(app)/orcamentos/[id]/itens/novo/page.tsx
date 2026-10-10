import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { getQuoteOr404, getServiceOptions } from "@/lib/pricing/queries";
import { saveItemAction } from "../../../actions";
import { ItemForm } from "../../../item-form";

export const metadata = { title: "Novo item" };

export default async function NovoItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppUser(OPERATE);
  const { id } = await params;
  const [{ quote }, services] = await Promise.all([getQuoteOr404(id), getServiceOptions()]);
  if (quote.status !== "rascunho") redirect(`/orcamentos/${id}`);
  return (
    <>
      <Link href={`/orcamentos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> {quote.quote_code}
      </Link>
      <PageHeader title="Novo item" description="Horas e custos diretos do serviço; o preço é calculado pelo motor AUDDOC011 com os parâmetros da cotação." />
      <ItemForm
        action={saveItemAction.bind(null, id, null)}
        params={quote.pricing_parameter_sets}
        services={services}
        initial={{ periodicity: "unica" }}
        cancelHref={`/orcamentos/${id}`}
        submitLabel="Adicionar item"
      />
    </>
  );
}
