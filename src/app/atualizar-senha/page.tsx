import { UpdatePasswordForm } from "./form";

export const metadata = { title: "Definir nova senha" };

export default async function AtualizarSenhaPage({ searchParams }: { searchParams: Promise<{ primeiro?: string }> }) {
  const sp = await searchParams;
  return <UpdatePasswordForm first={sp.primeiro === "1"} />;
}
