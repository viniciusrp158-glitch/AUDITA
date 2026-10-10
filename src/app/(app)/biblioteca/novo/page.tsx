import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { listLibrary, listParentOptions } from "@/lib/library/queries";
import { NewDocumentForm } from "./new-document-form";

export const metadata = { title: "Novo documento" };

export default async function NovoDocumentoPage() {
  await requireAppUser(ADMIN_ONLY);
  const [parents, { families }] = await Promise.all([listParentOptions(), listLibrary({})]);
  return (
    <>
      <Link href="/biblioteca" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Biblioteca
      </Link>
      <PageHeader title="Novo documento" description="Cadastre o documento oficial; o arquivo é enviado em seguida, como revisão." />
      <NewDocumentForm parents={parents} families={families} />
    </>
  );
}
