/** Exportação CSV dos resultados da prospecção (AUDDOC020 RP-13): um lead por linha, com os contatos do período. */
import type { NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatTaxId } from "@/lib/br";
import { csvFileName, csvResponse, toCsv } from "@/lib/csv";
import { formatDate, todaySaoPaulo } from "@/lib/format";
import { STAGE_LABEL, type Stage } from "@/lib/prospect/labels";
import { getProspectExportRows, isPeriod } from "@/lib/prospect/results";
import { BAND_LABEL, type ScoreBand } from "@/lib/prospect/score";

export async function GET(req: NextRequest) {
  await requireAppUser(OPERATE);
  const p = req.nextUrl.searchParams.get("periodo") ?? "30";
  const period = isPeriod(p) ? p : "30";
  const rows = await getProspectExportRows(period);
  const body = toCsv(
    ["Empresa", "Nome fantasia", "CNPJ", "Município", "Nicho", "Etapa", "Nota", "Faixa", "Entrou no funil", "Contatos no período", "Respostas no período", "Último contato", "Virou cliente"],
    rows.map((l) => [
      l.legal_name,
      l.trade_name,
      formatTaxId(l.cnpj),
      l.ibge_municipalities?.name,
      l.niche,
      STAGE_LABEL[l.stage as Stage] ?? l.stage,
      l.score,
      l.score_band ? BAND_LABEL[l.score_band as ScoreBand] : "",
      formatDate(l.created_at),
      l.contacts,
      l.replies,
      l.last_activity_at ? formatDate(l.last_activity_at) : "",
      l.client_id ? "Sim" : "",
    ]),
  );
  return csvResponse(body, csvFileName(`prospeccao_${period === "tudo" ? "tudo" : `${period}dias`}`, todaySaoPaulo()));
}
