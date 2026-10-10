import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Card, DefinitionList } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Modelos de documentos" };

type Template = {
  id: string;
  template_code: string;
  model_code: string;
  title: string;
  document_revision: string;
  technical_version: string;
  source_file_name: string;
  source_sha256: string;
  status: string;
  notes: string | null;
  created_at: string;
};

/** Versões técnicas dos modelos usados na emissão (AUDDOC017 RF-21): somente leitura; novas versões entram por migração revisada. */
export default async function ModelosPage() {
  await requireAppUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_templates")
    .select("id, template_code, model_code, title, document_revision, technical_version, source_file_name, source_sha256, status, notes, created_at")
    .order("template_code")
    .order("technical_version", { ascending: false });
  const rows = (data ?? []) as Template[];

  return (
    <>
      <Link href="/configuracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Configurações
      </Link>
      <PageHeader
        title="Modelos de documentos"
        description="Versões técnicas usadas pelo sistema para gerar propostas a partir dos anexos aprovados do AUDDOC010. A revisão documental (Rev.) é a do anexo oficial; a versão técnica (v1, v2…) muda quando o leiaute gerado muda."
      />
      <div className="space-y-4">
        {rows.map((t) => (
          <Card key={t.id} title={`${t.template_code} · ${t.model_code} — ${t.title}`}>
            <DefinitionList
              items={[
                { label: "Revisão do anexo", value: t.document_revision },
                { label: "Versão técnica", value: `${t.technical_version} (${t.status === "vigente" ? "vigente" : "substituída"})` },
                { label: "Cadastrada em", value: formatDateTime(t.created_at) },
                { label: "Arquivo oficial de origem", value: <span className="break-all">{t.source_file_name}</span> },
                { label: "SHA-256 do arquivo oficial", value: <span className="break-all font-mono text-xs">{t.source_sha256}</span> },
                { label: "Observações", value: t.notes },
              ]}
            />
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">Nenhum modelo cadastrado.</p>}
      </div>
    </>
  );
}
