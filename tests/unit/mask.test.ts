/** Máscaras de digitação dos formulários (Frente A, A9). */
import { describe, expect, it } from "vitest";
import { applyMask } from "@/lib/mask";

describe("Máscaras", () => {
  it("CNPJ numérico e alfanumérico, progressivo", () => {
    expect(applyMask("cnpj", "1")).toBe("1");
    expect(applyMask("cnpj", "123")).toBe("12.3");
    expect(applyMask("cnpj", "11222333000181")).toBe("11.222.333/0001-81");
    expect(applyMask("cnpj", "11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(applyMask("cnpj", "12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(applyMask("cnpj", "112223330001819999")).toBe("11.222.333/0001-81");
  });
  it("CPF e documento automático", () => {
    expect(applyMask("cpf", "52998224725")).toBe("529.982.247-25");
    expect(applyMask("taxid", "52998224725")).toBe("529.982.247-25");
    expect(applyMask("taxid", "112223330001")).toBe("11.222.333/0001");
  });
  it("telefone fixo, celular e com 55", () => {
    expect(applyMask("phone", "1")).toBe("(1");
    expect(applyMask("phone", "153")).toBe("(15) 3");
    expect(applyMask("phone", "1533334444")).toBe("(15) 3333-4444");
    expect(applyMask("phone", "15991234567")).toBe("(15) 99123-4567");
    expect(applyMask("phone", "+55 15 99123-4567")).toBe("(15) 99123-4567");
    expect(applyMask("phone", "(15) 3333-4444")).toBe("(15) 3333-4444");
    expect(applyMask("phone", "")).toBe("");
  });
  it("CEP e CNAE", () => {
    expect(applyMask("cep", "18035")).toBe("18035");
    expect(applyMask("cep", "180350000")).toBe("18035-000");
    expect(applyMask("cnae", "4120400")).toBe("4120-4/00");
    expect(applyMask("cnae", "4120-4/00")).toBe("4120-4/00");
  });
});
