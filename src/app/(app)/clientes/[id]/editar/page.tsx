import { PageHeader } from "@/components/page";
import { CodeBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { getClientOr404 } from "@/lib/clients/queries";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../client-form";

export const metadata = { title: "Editar cliente" };

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppUser();
  const { id } = await params;
  const client = await getClientOr404(id);

  return (
    <>
      <PageHeader title="Editar cliente" description="O código do cliente não pode ser alterado." />
      <div className="mb-4">
        <CodeBadge code={client.client_code} />
      </div>
      <div className="max-w-4xl rounded-xl border border-line bg-white p-6">
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          initial={client}
          submitLabel="Salvar alterações"
          cancelHref={`/clientes/${client.id}`}
          isDev={false}
        />
      </div>
    </>
  );
}
