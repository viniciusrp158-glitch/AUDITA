/** Download de M03–M06 gerado: confere pela RLS e redireciona para link assinado de curta duração (bucket privado). */
import { NextResponse, type NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id, docId } = await params;
  if (!uuidRe.test(id) || !uuidRe.test(docId)) return new NextResponse("Documento não encontrado.", { status: 404 });
  const pdf = req.nextUrl.searchParams.get("formato") !== "docx";
  const supabase = await createClient();
  const { data: doc } = await supabase.from("contract_documents").select("docx_path, pdf_path").eq("id", docId).eq("contract_id", id).maybeSingle();
  if (!doc) return new NextResponse("Documento não encontrado.", { status: 404 });
  const path = pdf ? doc.pdf_path : doc.docx_path;
  const signed = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60, { download: path.split("/").pop()!.replace(/_\d+(\.\w+)$/, "$1") });
  if (signed.error || !signed.data) return new NextResponse("Não foi possível gerar o acesso ao arquivo.", { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
