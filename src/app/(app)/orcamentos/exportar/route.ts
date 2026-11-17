/** Exportação CSV dos orçamentos com os mesmos filtros da tela (Frente A, A11). Sem valores: preço e margem ficam na
 *  tela da cotação, com as permissões dela. Consulta pela RLS do usuário. */
import type { NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { CSV_MAX_ROWS, csvFileName, csvResponse, toCsv } from "@/lib/csv";
import { formatDateTime, todaySaoPaulo } from "@/lib/format";
import { QUOTE_STATUS } from "@/lib/pricing/labels";
import { listQuotes } from "@/lib/pricing/queries";

export async function GET(req: NextRequest) {
  await requireAppUser(OPERATE);
  const sp = req.nextUrl.searchParams;
  const { rows, error } = await listQuotes({ q: (sp.get("q") ?? "").slice(0, 80), situacao: sp.get("situacao") ?? "", page: 1, size: CSV_MAX_ROWS });
  if (error) return new Response("Não foi possível exportar agora. Tente de novo.", { status: 500 });
  const body = toCsv(
    ["Código", "Demanda", "Solicitação", "Cliente (código)", "Cliente", "Itens", "Atualizado em", "Situação", "Teste"],
    rows.map((r) => [
      r.quote_code,
      r.demands?.demand_code,
      r.demands?.summary,
      r.clients?.client_code,
      r.clients?.trade_name || r.clients?.legal_name,
      r.quote_items?.length ?? 0,
      formatDateTime(r.updated_at),
      QUOTE_STATUS[r.status]?.label ?? r.status,
      r.is_test ? "Sim" : "",
    ]),
  );
  return csvResponse(body, csvFileName("orcamentos", todaySaoPaulo()));
}
