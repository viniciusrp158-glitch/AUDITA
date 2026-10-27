/** Prévia em Word da próxima revisão da Lista Mestra (marcada "PRÉVIA — AINDA NÃO APROVADA"; não fica registrada). */
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { isProduction } from "@/lib/env";
import { todaySaoPaulo } from "@/lib/format";
import { MIME_BY_EXT } from "@/lib/library/labels";
import { getMasterListState, MASTER_LIST_CODE, renderMasterListDocx } from "@/lib/library/master-list";

export async function GET() {
  const me = await requireAppUser(ADMIN_ONLY);
  const s = await getMasterListState();
  const buf = await renderMasterListDocx(s.data, {
    revision: s.nextRevision,
    approvedBy: `${me.fullName} (pendente)`,
    approvedOn: todaySaoPaulo(),
    fingerprint: s.fingerprint,
    preview: true,
    test: !isProduction,
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME_BY_EXT.docx,
      "Content-Disposition": `attachment; filename="${MASTER_LIST_CODE}_PREVIA_${s.nextRevision.replace(".", "")}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
