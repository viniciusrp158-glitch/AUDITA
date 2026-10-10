/**
 * Download de documento oficial (RF-22, RF-24): permissão conferida pela RLS, download registrado na trilha
 * e redirecionamento para link assinado de 60 s do bucket privado. Nenhum link público.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { LIBRARY_BUCKET } from "@/lib/library/labels";
import { createClient } from "@/lib/supabase/server";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ revId: string }> }) {
  await requireAppUser();
  const { revId } = await params;
  if (!uuidRe.test(revId)) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const supabase = await createClient();
  const { data: rev } = await supabase.from("library_revisions").select("id, storage_path, original_name").eq("id", revId).maybeSingle();
  if (!rev) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const signed = await supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(rev.storage_path, 60, { download: rev.original_name });
  if (signed.error || !signed.data) return new NextResponse("Não foi possível gerar o acesso ao arquivo.", { status: 500 });
  await supabase.rpc("log_library_download", { p_revision_id: rev.id });
  return NextResponse.redirect(signed.data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
