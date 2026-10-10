import { PageHeader } from "@/components/page";
import { CodeBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { getDemandFormOptions, getDemandOr404 } from "@/lib/demands/queries";
import { loadClientLinksAction, updateDemandAction } from "../../actions";
import { DemandForm } from "../../demand-form";

export const metadata = { title: "Editar demanda" };

export default async function EditarDemandaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppUser(OPERATE);
  const { id } = await params;
  const d = await getDemandOr404(id);
  const [options, links] = await Promise.all([getDemandFormOptions(d.client_id), loadClientLinksAction(d.client_id)]);
  // Mantém vínculos atuais mesmo se a unidade/contato tiver sido inativado depois
  if (d.client_units && !links.units.some((u) => u.id === d.client_units!.id)) links.units.push(d.client_units);
  if (d.client_contacts && !links.contacts.some((c) => c.id === d.client_contacts!.id)) {
    links.contacts.push({ id: d.client_contacts.id, label: d.client_contacts.full_name });
  }

  return (
    <>
      <PageHeader title="Editar demanda" description="O código da demanda é permanente. A situação é alterada na própria demanda." />
      <div className="mb-4">
        <CodeBadge code={d.demand_code} />
      </div>
      <div className="max-w-4xl rounded-xl border border-line bg-white p-4 sm:p-6">
        <DemandForm
          action={updateDemandAction.bind(null, d.id)}
          options={options}
          initialLinks={links}
          initial={{
            client_id: d.client_id,
            unit_id: d.unit_id,
            contact_id: d.contact_id,
            service_id: d.service_id,
            origin: d.origin,
            summary: d.summary,
            description: d.description,
            location: d.location,
            received_on: d.received_on,
            due_on: d.due_on,
            is_recurring: d.is_recurring,
            viability_checked: d.viability_checked,
            viability_notes: d.viability_notes,
            notes: d.notes,
          }}
          submitLabel="Salvar alterações"
          cancelHref={`/demandas/${d.id}`}
          isDev={false}
        />
      </div>
    </>
  );
}
