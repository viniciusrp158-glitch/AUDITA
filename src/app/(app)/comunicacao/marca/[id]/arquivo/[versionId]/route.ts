import { requireAppUser } from "@/lib/auth";
import { downloadBrandFile, getBrandAssetOr404 } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";

/** Arquivo de marca (o marketing só recebe versões aprovadas: RLS + política do Storage). Conferido pelo SHA-256. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  await requireAppUser(COMMUNICATE);
  const { id, versionId } = await params;
  const asset = await getBrandAssetOr404(id);
  const v = asset.versions.find((x) => x.id === versionId);
  if (!v) return new Response("Arquivo não encontrado.", { status: 404 });
  const buf = await downloadBrandFile(v.storage_path, v.sha256);
  if (!buf) return new Response("Arquivo indisponível ou não confere com o SHA-256 registrado.", { status: 409 });
  const download = new URL(req.url).searchParams.get("baixar") === "1";
  const safe = v.original_name.replace(/[^\w.\-]+/g, "_");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": v.mime_type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // SVG nunca é exibido inline (evita script embutido); sempre baixado
      "Content-Disposition": `${download || v.mime_type === "image/svg+xml" ? "attachment" : "inline"}; filename="${safe}"`,
      ...(v.mime_type === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; sandbox" } : {}),
    },
  });
}
