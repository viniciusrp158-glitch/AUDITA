import Link from "next/link";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { listCourses } from "@/lib/training/queries";
import { PackageImporter, type ExistingCourse } from "./importer";

export const metadata = { title: "Importar pacote · Treinamentos" };

export default async function ImportarPacotePage() {
  await requireAppUser(ADMIN_ONLY);
  const { rows } = await listCourses("");
  const existing: ExistingCourse[] = rows.map((c) => ({
    id: c.id,
    code: c.course_code,
    versions: c.training_versions.map((v) => v.version_label),
    hasDraft: c.training_versions.some((v) => v.status === "rascunho"),
  }));
  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link href="/treinamentos" className="hover:text-navy">
          Treinamentos
        </Link>{" "}
        › Importar pacote
      </p>
      <PageHeader
        title="Importar pacote do treinamento (.zip)"
        description="Envie o .zip no padrão do material (00_Orientacoes, 01_Ficha_e_Plano, 02_Aluno, 03_Instrutor, 04_Slides). O sistema lê a ficha técnica, monta os módulos, guarda cada arquivo no lugar certo e lê as questões dos gabaritos. Você confere tudo antes de gravar; o resultado é uma versão em rascunho."
      />
      <PackageImporter existing={existing} />
    </>
  );
}
