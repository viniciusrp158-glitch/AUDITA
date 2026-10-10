import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { getDemandFormOptions } from "@/lib/demands/queries";
import { isProduction } from "@/lib/env";
import { createDemandAction } from "../actions";
import { DemandForm } from "../demand-form";

export const metadata = { title: "Nova demanda" };

export default async function NovaDemandaPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await requireAppUser(OPERATE);
  const { cliente } = await searchParams;
  const options = await getDemandFormOptions();
  const preselected = options.clients.some((c) => c.id === cliente) ? cliente : undefined;

  return (
    <>
      <PageHeader
        title="Nova demanda"
        description="Registre a solicitação em uma única tela. O código DEM é gerado ao salvar; os campos não aplicáveis podem ficar em branco."
      />
      <div className="max-w-4xl rounded-xl border border-line bg-white p-4 sm:p-6">
        <DemandForm
          action={createDemandAction}
          options={options}
          initial={preselected ? { client_id: preselected } : undefined}
          submitLabel="Registrar demanda"
          cancelHref={preselected ? `/clientes/${preselected}?aba=relacionamento` : "/demandas"}
          isDev={!isProduction}
        />
      </div>
    </>
  );
}
