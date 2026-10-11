import { requireAppUser } from "@/lib/auth";
import { renderSnapshot } from "@/lib/comunicacao/piece-image";
import { getPieceVersion } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";

/** Visualização de uma versão congelada (para a revisão e o histórico). Não é exportação. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; v: string }> }) {
  await requireAppUser(COMMUNICATE);
  const { id, v } = await params;
  const version = await getPieceVersion(id, Number(v));
  if (!version) return new Response("Versão não encontrada.", { status: 404 });
  const { png } = await renderSnapshot(version.snapshot);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
