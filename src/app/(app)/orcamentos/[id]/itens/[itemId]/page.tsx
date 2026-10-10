import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Alert, CheckboxField, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { getQuoteOr404, getServiceOptions } from "@/lib/pricing/queries";
import { removeItemAction, saveItemAction } from "../../../actions";
import { ItemForm } from "../../../item-form";

export const metadata = { title: "Editar item" };

export default async function EditarItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ confirmar?: string }>;
}) {
  const user = await requireAppUser(OPERATE);
  const { id, itemId } = await params;
  const sp = await searchParams;
  const [{ quote, items }, services] = await Promise.all([getQuoteOr404(id), getServiceOptions()]);
  const item = items.find((i) => i.id === itemId);
  if (!item) notFound();
  if (quote.status !== "rascunho") redirect(`/orcamentos/${id}`);
  return (
    <>
      <Link href={`/orcamentos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> {quote.quote_code}
      </Link>
      <PageHeader title="Editar item" description={item.description} />
      <ItemForm
        action={saveItemAction.bind(null, id, itemId)}
        params={quote.pricing_parameter_sets}
        services={services}
        initial={item}
        cancelHref={`/orcamentos/${id}`}
        canPrice={user.role === "admin"}
        submitLabel="Salvar item"
      />
      <div className="mt-8">
        <Card title="Remover item">
          <form action={removeItemAction.bind(null, id, itemId)} className="space-y-3">
            {sp.confirmar && <Alert kind="error">Marque a confirmação para remover.</Alert>}
            <CheckboxField name="confirm" label="Confirmo a remoção deste item do rascunho (fica registrada no histórico)." />
            <div className="sm:max-w-xs">
              <SubmitButton pendingText="Removendo…" variant="danger">
                <span className="inline-flex items-center gap-2">
                  <Trash2 size={15} /> Remover item
                </span>
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
