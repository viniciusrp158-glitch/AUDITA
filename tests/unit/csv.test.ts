/** Exportação CSV das listas (Frente A, A11): formato do Excel em português e proteção contra fórmula. */
import { describe, expect, it } from "vitest";
import { csvCell, csvFileName, toCsv } from "@/lib/csv";

describe("CSV das listas", () => {
  it("usa ; como separador, BOM e CRLF", () => {
    const out = toCsv(["Código", "Nome"], [["CLI-0001", "ÁGUA & CIA"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe("﻿Código;Nome\r\nCLI-0001;ÁGUA & CIA\r\n");
  });
  it("coloca aspas quando há separador, aspas ou quebra de linha", () => {
    expect(csvCell('Rua A; nº "1"')).toBe('"Rua A; nº ""1"""');
    expect(csvCell("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });
  it("neutraliza fórmulas (= + - @)", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+5511")).toBe("'+5511");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@soma")).toBe("'@soma");
  });
  it("vazio para nulo, número como texto", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(3)).toBe("3");
  });
  it("nome do arquivo com a data", () => {
    expect(csvFileName("clientes", "2026-11-17")).toBe("clientes_2026-11-17.csv");
  });
});
