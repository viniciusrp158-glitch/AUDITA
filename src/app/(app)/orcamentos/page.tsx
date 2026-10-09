import { PageHeader, UnderConstruction } from "@/components/page";

export const metadata = { title: "Orçamentos" };

export default function Page() {
  return (
    <>
      <PageHeader title="Orçamentos" description="Cotações calculadas pela metodologia AUDDOC011." />
      <UnderConstruction increment="Incremento I5–I6" items={['Itens com horas e despesas diretas', 'Motor AUDDOC011 com cálculo decimal exato e indicação de PENDENTE', 'Revisões imutáveis e emissão DOCX/PDF (AUDDOC010-ANX01/ANX02)']} />
    </>
  );
}
