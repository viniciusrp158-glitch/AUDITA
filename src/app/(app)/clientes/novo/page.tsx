import Link from "next/link";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { isProduction } from "@/lib/env";
import { getClientDraftFromLead } from "@/lib/prospect/conversion";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata = { title: "Novo cliente" };

export default async function NovoClientePage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  await requireAppUser(OPERATE);
  const sp = await searchParams;
  // Conversão do lead da prospecção (AUDDOC020 RP-12): o formulário já vem preenchido pela Receita e pelo lead
  const draft = sp.lead ? await getClientDraftFromLead(sp.lead) : null;
  const leadHref = draft ? `/prospeccao/leads/${draft.lead.id}` : null;

  return (
    <>
      <PageHeader
        title={draft ? "Converter lead em cliente" : "Novo cliente"}
        description="O código CLI é gerado automaticamente ao salvar e não poderá ser alterado nem reutilizado."
      />
      {draft?.lead.client_id ? (
        <Alert kind="info">
          Este lead já está vinculado a um cliente. <Link href={`/clientes/${draft.lead.client_id}`} className="font-semibold underline">Abrir a ficha do cliente</Link>
        </Alert>
      ) : draft?.existing ? (
        <Alert kind="warning">
          Já existe o cliente <strong>{draft.existing.client_code}</strong> — {draft.existing.legal_name} com este CNPJ. Não cadastre de novo:{" "}
          <Link href={leadHref!} className="font-semibold underline">
            volte ao lead e use &quot;Vincular a este cliente&quot;
          </Link>
          .
        </Alert>
      ) : (
        <>
          {draft && (
            <div className="mb-4 max-w-4xl">
              <Alert kind="info">
                Dados preenchidos pelo lead <strong>{draft.lead.name}</strong> e pela base pública da Receita. Confira antes de
                salvar — telefone e e-mail da Receita costumam ser do contador. Ao cadastrar, o lead fica vinculado ao cliente.
              </Alert>
            </div>
          )}
          <div className="max-w-4xl rounded-xl border border-line bg-white p-6">
            <ClientForm
              action={createClientAction}
              submitLabel="Cadastrar cliente"
              cancelHref={leadHref ?? "/clientes"}
              isDev={!isProduction}
              initial={draft?.initial}
              hidden={draft ? { lead_id: draft.lead.id } : undefined}
            />
          </div>
        </>
      )}
    </>
  );
}
