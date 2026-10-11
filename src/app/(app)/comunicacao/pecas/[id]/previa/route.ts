import { requireAppUser } from "@/lib/auth";
import { renderDraft } from "@/lib/comunicacao/piece-image";
import { getPieceOr404 } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";

/** Prévia do rascunho (não é exportação: não é registrada e leva a faixa de teste fora da produção). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAppUser(COMMUNICATE);
  const { id } = await params;
  const piece = await getPieceOr404(id);
  const png = await renderDraft(piece);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
