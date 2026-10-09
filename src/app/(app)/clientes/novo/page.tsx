import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { isProduction } from "@/lib/env";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await requireAppUser();
  return (
    <>
      <PageHeader
        title="Novo cliente"
        description="O código CLI é gerado automaticamente ao salvar e não poderá ser alterado nem reutilizado."
      />
      <div className="max-w-4xl rounded-xl border border-line bg-white p-6">
        <ClientForm action={createClientAction} submitLabel="Cadastrar cliente" cancelHref="/clientes" isDev={!isProduction} />
      </div>
    </>
  );
}
