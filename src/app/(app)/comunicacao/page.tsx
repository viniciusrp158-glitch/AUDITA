import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { PageHeader, UnderConstruction } from "@/components/page";

export const metadata = { title: "Comunicação" };

export default async function Page() {
  await requireAppUser(ADMIN_ONLY);
  return (
    <>
      <PageHeader title="Comunicação" description="Identidade visual e materiais institucionais." />
      <UnderConstruction increment="Incremento I10 (V1.2)" items={['Logos oficiais e paleta do AUDDOC003', 'Modelos e briefings com revisão humana', 'Integração com IA somente após autorização']} />
    </>
  );
}
