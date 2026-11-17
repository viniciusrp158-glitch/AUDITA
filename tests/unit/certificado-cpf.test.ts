import { describe, expect, it } from "vitest";
import { maskCpf } from "../../aluno/src/lib/cpf";

describe("certificado: CPF mascarado", () => {
  it("oculta os 3 primeiros e os 2 últimos dígitos", () => {
    expect(maskCpf("12345678909")).toBe("***.456.789-**");
    expect(maskCpf("123.456.789-09")).toBe("***.456.789-**");
  });
  it("sem CPF válido não mostra nada", () => {
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf("")).toBeNull();
    expect(maskCpf("1234")).toBeNull();
  });
});
