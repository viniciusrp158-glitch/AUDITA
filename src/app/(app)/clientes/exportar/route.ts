/** Exportação CSV da lista de clientes com os mesmos filtros da tela (Frente A, A11). Consulta pela RLS do usuário. */
import type { NextRequest } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { formatTaxId } from "@/lib/br";
import { listClients } from "@/lib/clients/queries";
import { CSV_MAX_ROWS, csvFileName, csvResponse, toCsv } from "@/lib/csv";
import { todaySaoPaulo } from "@/lib/format";

export async function GET(req: NextRequest) {
  await requireAppUser(OPERATE);
  const sp = req.nextUrl.searchParams;
  const situacao = ["ativos", "inativos", "todos"].includes(sp.get("situacao") ?? "") ? sp.get("situacao")! : "ativos";
  const { rows, error } = await listClients({ q: (sp.get("q") ?? "").slice(0, 80), situacao, page: 1, size: CSV_MAX_ROWS });
  if (error) return new Response("Não foi possível exportar agora. Tente de novo.", { status: 500 });
  const body = toCsv(
    ["Código", "Razão social / nome", "Nome fantasia", "CNPJ/CPF", "Segmento", "Município", "UF", "Situação", "Teste"],
    rows.map((c) => [c.client_code, c.legal_name, c.trade_name, formatTaxId(c.tax_id), c.segment, c.address_city, c.address_state, c.status === "ativo" ? "Ativo" : "Inativo", c.is_test ? "Sim" : ""]),
  );
  return csvResponse(body, csvFileName("clientes", todaySaoPaulo()));
}
