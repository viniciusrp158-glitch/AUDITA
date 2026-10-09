import { PageHeader, UnderConstruction } from "@/components/page";

export const metadata = { title: "Clientes" };

export default function Page() {
  return (
    <>
      <PageHeader title="Clientes" description="Cadastro mestre de empresas, unidades e contatos." />
      <UnderConstruction increment="Incremento I2" items={['Cadastro com código permanente CLI-NNNN, nunca reutilizado', 'Unidades e contatos por cliente', 'Pesquisa por nome, código e CNPJ/CPF, com alerta de duplicidade', 'Inativação lógica e histórico']} />
    </>
  );
}
