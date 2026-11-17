/**
 * Exportação CSV das listas (Frente A, A2/A11), no formato que o Excel em português abre direto: separador ";",
 * UTF-8 com BOM e quebra de linha CRLF. Células que começam com = + - @ (ou tabulação) recebem um apóstrofo para não
 * virarem fórmula ao abrir (injeção de fórmula em planilha).
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

/** Nome do arquivo: prefixo + data de hoje em São Paulo (ex.: clientes_2026-11-17.csv). */
export function csvFileName(prefix: string, today: string): string {
  return `${prefix}_${today}.csv`;
}

export function csvResponse(body: string, fileName: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Limite de linhas por exportação (o servidor de dados devolve no máximo 1000 por consulta). */
export const CSV_MAX_ROWS = 1000;
