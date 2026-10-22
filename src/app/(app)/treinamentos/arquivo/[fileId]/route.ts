/**
 * Abertura de material de treinamento (T1): permissão conferida pela RLS, acesso registrado na trilha e
 * redirecionamento para link assinado de 60 s do bucket privado. Nenhum link público.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { TRAINING_BUCKET } from "@/lib/training/labels";
import { createClient } from "@/lib/supabase/server";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { fileId } = await params;
  if (!uuidRe.test(fileId)) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const supabase = await createClient();
  const { data: f } = await supabase.from("training_files").select("id, storage_path, original_name").eq("id", fileId).maybeSingle();
  if (!f) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const signed = await supabase.storage.from(TRAINING_BUCKET).createSignedUrl(f.storage_path, 60);
  if (signed.error || !signed.data) return new NextResponse("Não foi possível gerar o acesso ao arquivo.", { status: 500 });
  await supabase.rpc("log_training_download", { p_file_id: f.id });
  return NextResponse.redirect(signed.data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
