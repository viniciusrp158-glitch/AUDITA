/** Exportação CSV das demandas com os mesmos filtros da tela (Frente A, A11). Consulta pela RLS do usuário. */
import type { NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { CSV_MAX_ROWS, csvFileName, csvResponse, toCsv } from "@/lib/csv";
import { DEMAND_STATUS } from "@/lib/demands/labels";
import { listDemands } from "@/lib/demands/queries";
import { formatDay, todaySaoPaulo } from "@/lib/format";

export async function GET(req: NextRequest) {
  await requireAppUser(OPERATE);
  const sp = req.nextUrl.searchParams;
  const g = sp.get("grupo");
  const grupo = g === "encerradas" || g === "todas" ? g : "abertas";
  const { rows, error } = await listDemands({
    q: (sp.get("q") ?? "").slice(0, 80),
    grupo,
    situacao: sp.get("situacao") ?? "",
    waiting: sp.get("alerta") === "aguardando",
    page: 1,
    size: CSV_MAX_ROWS,
  });
  if (error) return new Response("Não foi possível exportar agora. Tente de novo.", { status: 500 });
  const body = toCsv(
    ["Código", "Solicitação", "Cliente (código)", "Cliente", "Serviço", "Recebida", "Prazo", "Situação", "Recorrente", "Teste"],
    rows.map((d) => [
      d.demand_code,
      d.summary,
      d.clients?.client_code,
      d.clients?.trade_name || d.clients?.legal_name,
      d.services ? `${d.services.service_code} — ${d.services.name}` : "",
      formatDay(d.received_on),
      formatDay(d.due_on),
      DEMAND_STATUS[d.status]?.label ?? d.status,
      d.is_recurring ? "Sim" : "",
      d.is_test ? "Sim" : "",
    ]),
  );
  return csvResponse(body, csvFileName("demandas", todaySaoPaulo()));
}
