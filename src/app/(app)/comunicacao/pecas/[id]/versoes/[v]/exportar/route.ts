import { createHash } from "node:crypto";
import { requireAppUser } from "@/lib/auth";
import { renderSnapshot } from "@/lib/comunicacao/piece-image";
import { getPieceVersion } from "@/lib/comunicacao/queries";
import { renderPiecePdf } from "@/lib/comunicacao/render";
import { isProduction } from "@/lib/env";
import { COMMUNICATE } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Exportação (AUDDOC017 RF-28): somente de versão APROVADA; o arquivo é gerado do conteúdo congelado, com o logo
 * conferido pelo SHA-256, e cada exportação fica registrada (formato, SHA-256, autor e data). Nada é publicado.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; v: string }> }) {
  await requireAppUser(COMMUNICATE);
  const { id, v } = await params;
  const format = new URL(req.url).searchParams.get("formato") === "pdf" ? "pdf" : "png";
  const version = await getPieceVersion(id, Number(v));
  if (!version) return new Response("Versão não encontrada.", { status: 404 });
  if (version.status !== "aprovada") return new Response("Somente versões aprovadas podem ser exportadas.", { status: 409 });

  const { png, logoOk } = await renderSnapshot(version.snapshot);
  if (!logoOk)
    return new Response("O logo usado nesta versão não está mais disponível ou não confere (SHA-256). Reabra a peça e envie nova versão.", {
      status: 409,
    });
  const code = version.snapshot.piece.piece_code;
  const file =
    format === "pdf"
      ? await renderPiecePdf(png, version.snapshot.piece.template, { title: version.snapshot.piece.title ?? code, subject: `${code} v${version.version}` })
      : png;
  const sha256 = createHash("sha256").update(file).digest("hex");
  const supabase = await createClient();
  const reg = await supabase.rpc("register_comm_export", { p_version_id: version.id, p_format: format, p_sha256: sha256, p_size: file.length });
  if (reg.error) return new Response("Exportação não autorizada.", { status: 409 });

  const test = !isProduction || version.is_test;
  const name = `${test ? "TESTE_" : ""}${code}_v${version.version}.${format}`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "image/png",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-SHA256": sha256,
    },
  });
}
