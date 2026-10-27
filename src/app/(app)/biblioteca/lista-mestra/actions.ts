"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { LIBRARY_BUCKET, MIME_BY_EXT } from "@/lib/library/labels";
import { fingerprintNote, getMasterListState, MASTER_LIST_CODE, MASTER_LIST_TITLE, renderMasterListDocx } from "@/lib/library/master-list";
import { createClient } from "@/lib/supabase/server";

export type MasterState = { error?: string; fieldErrors?: Record<string, string> };

/**
 * Aprovação do Diretor: gera o arquivo da nova revisão com o conteúdo atual do catálogo, registra na Biblioteca e
 * publica como vigente (a anterior vira substituída). Nenhum arquivo é baixado, editado ou enviado à mão.
 */
export async function publishMasterListAction(_prev: MasterState, formData: FormData): Promise<MasterState> {
  const me = await requireAppUser(ADMIN_ONLY);
  const approvedBy = String(formData.get("approved_by") ?? "").trim();
  if (approvedBy.length < 3 || approvedBy.length > 200) return { fieldErrors: { approved_by: "Informe quem aprovou." }, error: "Revise os campos destacados." };
  if (formData.get("confirm") !== "on") return { fieldErrors: { confirm: "Confirme a aprovação." }, error: "Confirme antes de publicar." };

  const state = await getMasterListState();
  if (state.upToDate) return { error: "A revisão vigente já corresponde ao catálogo atual; não há o que publicar." };

  const supabase = await createClient();
  let documentId = state.documentId;
  if (!documentId) {
    const { data, error } = await supabase
      .from("library_documents")
      .insert({
        doc_code: MASTER_LIST_CODE,
        title: MASTER_LIST_TITLE,
        kind: "documento",
        family: "Serviços",
        phase: "fase2",
        visibility: "interno",
        notes: "Documento gerado automaticamente pelo sistema a partir do catálogo de serviços e dos treinamentos EAD (pedido do Diretor em 27/10/2026).",
      })
      .select("id")
      .single();
    if (error || !data) return { error: error?.code === "23505" ? `O código ${MASTER_LIST_CODE} já está em uso por outro documento.` : "Não foi possível cadastrar o documento." };
    documentId = data.id;
  }

  const today = todaySaoPaulo();
  const meta = { revision: state.nextRevision, approvedBy, approvedOn: today, fingerprint: state.fingerprint, test: !isProduction };
  const buf = await renderMasterListDocx(state.data, meta);
  const fileName = `${MASTER_LIST_CODE}_Lista_Mestra_Servicos_Treinamentos_${meta.revision.replace(".", "")}.docx`;
  const path = `library/${documentId}/rev${meta.revision.slice(4)}/${Date.now()}_${fileName}`;
  const signed = await supabase.storage.from(LIBRARY_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return { error: "Não foi possível preparar o arquivo no armazenamento." };
  const up = await supabase.storage.from(LIBRARY_BUCKET).uploadToSignedUrl(path, signed.data.token, buf, { contentType: MIME_BY_EXT.docx });
  if (up.error) return { error: "Não foi possível gravar o arquivo no armazenamento." };

  const { data: rev, error: revError } = await supabase
    .from("library_revisions")
    .insert({
      document_id: documentId,
      revision: meta.revision,
      approved_by: approvedBy,
      approved_on: today,
      issued_on: today,
      notes: fingerprintNote(state.fingerprint, state.changes),
      storage_path: path,
      original_name: fileName,
      mime_type: MIME_BY_EXT.docx,
      size_bytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
    })
    .select("id")
    .single();
  if (revError || !rev) return { error: revError?.code === "23505" ? "Esta revisão já existe; recarregue a página." : "Não foi possível registrar a revisão." };
  const { error } = await supabase.rpc("publish_library_revision", { p_revision_id: rev.id });
  if (error) return { error: "A revisão foi registrada como rascunho, mas não pôde ser publicada. Publique pela Biblioteca." };

  console.info(`[lista-mestra] ${meta.revision} publicada por ${me.email}`);
  revalidatePath("/biblioteca");
  revalidatePath(`/biblioteca/${documentId}`);
  revalidatePath("/");
  redirect(`/biblioteca/lista-mestra?publicada=${encodeURIComponent(meta.revision)}`);
}
