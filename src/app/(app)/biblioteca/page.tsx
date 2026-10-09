import { PageHeader, UnderConstruction } from "@/components/page";

export const metadata = { title: "Biblioteca" };

export default function Page() {
  return (
    <>
      <PageHeader title="Biblioteca" description="Documentos oficiais AUDDOC e anexos aprovados." />
      <UnderConstruction increment="Incremento I7" items={['Importação dos arquivos oficiais com código, revisão e hash', 'Vigentes e substituídos, sem sobrescrever versões', 'Visualização e download por link temporário']} />
    </>
  );
}
