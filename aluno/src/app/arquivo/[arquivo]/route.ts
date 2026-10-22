import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "audita-treinamentos";

/**
 * Entrega um material do aluno (apostila ou ficha técnica) pelo próprio site, com a sessão do aluno: a RLS só mostra
 * arquivos do público "aluno" das versões em que ele está matriculado, e a apostila só sai se o módulo estiver liberado.
 * ?baixar=1 → download; sem o parâmetro → exibição (leitor da apostila).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  if (!isUuid(arquivo)) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  const supabase = await createClient();
  const { data: f } = await supabase
    .from("training_files")
    .select("id, version_id, module_id, storage_path, original_name, mime_type")
    .eq("id", arquivo)
    .eq("status", "ativo")
    .maybeSingle();
  if (!f) return new NextResponse("Arquivo não encontrado.", { status: 404 });
  if (f.module_id) {
    const { data: enr } = await supabase.from("training_enrollments").select("id").eq("version_id", f.version_id).in("status", ["ativa", "concluida"]);
    let unlocked = false;
    for (const e of enr ?? []) {
      const { data: outline } = await supabase.rpc("training_outline", { p_enrollment_id: e.id });
      if ((outline as { module_id: string; unlocked: boolean }[] | null)?.some((m) => m.module_id === f.module_id && m.unlocked)) unlocked = true;
    }
    if (!unlocked) return new NextResponse("Conclua o módulo anterior para liberar este material.", { status: 403 });
  }
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(f.storage_path);
  if (error || !blob) return new NextResponse("Não foi possível abrir o arquivo.", { status: 502 });
  const download = request.nextUrl.searchParams.get("baixar") === "1";
  const name = encodeURIComponent(f.original_name);
  return new NextResponse(blob.stream(), {
    headers: {
      "Content-Type": f.mime_type || "application/pdf",
      "Content-Length": String(blob.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
    },
  });
}
