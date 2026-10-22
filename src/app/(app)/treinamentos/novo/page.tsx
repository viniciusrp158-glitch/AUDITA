import Link from "next/link";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { NewCourseForm } from "./new-course-form";

export const metadata = { title: "Novo treinamento" };

export default async function NovoTreinamentoPage() {
  await requireAppUser(ADMIN_ONLY);
  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link href="/treinamentos" className="hover:text-navy">
          Treinamentos
        </Link>{" "}
        › Novo
      </p>
      <PageHeader
        title="Novo treinamento"
        description="Informe o código e a versão do material (ex.: L01, versão 1.2). O Módulo 01 — Ambientação — é criado automaticamente; os demais módulos e os materiais você inclui em seguida."
      />
      <section className="max-w-2xl rounded-xl border border-line bg-white p-5">
        <NewCourseForm />
      </section>
    </>
  );
}
