import { PageHeader, UnderConstruction } from "@/components/page";

export const metadata = { title: "Demandas" };

export default function Page() {
  return (
    <>
      <PageHeader title="Demandas" description="Registro Único de Atendimento (AUDDOC009)." />
      <UnderConstruction increment="Incremento I4" items={['Registro de solicitação vinculado a cliente e serviço', 'Situações do AUDDOC009 (Recebida → Encerrada)', 'Histórico e ligação com orçamento']} />
    </>
  );
}
