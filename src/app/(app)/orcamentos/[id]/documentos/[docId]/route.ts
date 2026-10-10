/**
 * Download de documento emitido (RF-22, RF-24): confere permissão pela RLS, registra o download na trilha
 * e redireciona para um link assinado de curta duração do bucket privado. Nenhum link público é criado.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id, docId } = await params;
  if (!uuidRe.test(id) || !uuidRe.test(docId)) return new NextResponse("Documento não encontrado.", { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("generated_documents")
    .select("id, quote_id, storage_path, file_name")
    .eq("id", docId)
    .eq("quote_id", id)
    .maybeSingle();
  if (!doc) return new NextResponse("Documento não encontrado.", { status: 404 });

  const signed = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (signed.error || !signed.data) return new NextResponse("Não foi possível gerar o acesso ao arquivo.", { status: 500 });
  await supabase.rpc("log_document_download", { p_document_id: doc.id });

  return NextResponse.redirect(signed.data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
