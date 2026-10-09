import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format";

describe("formatação pt-BR (fuso America/Sao_Paulo)", () => {
  it("formata data dd/mm/aaaa", () => {
    expect(formatDate("2026-10-09T15:00:00Z")).toBe("09/10/2026");
  });
  it("converte UTC para o horário de São Paulo", () => {
    // 02:30 UTC de 10/10 = 23:30 de 09/10 em São Paulo (UTC-3)
    expect(formatDateTime("2026-10-10T02:30:00Z")).toBe("09/10/2026 23:30");
  });
});
