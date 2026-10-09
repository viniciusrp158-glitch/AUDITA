import { describe, expect, it } from "vitest";
import {
  formatCep,
  formatCnae,
  formatCnpj,
  formatCpf,
  formatPhone,
  isValidCnpj,
  isValidCpf,
  onlyDigits,
} from "@/lib/br";

describe("documentos brasileiros (mesmas regras do banco)", () => {
  it("valida CNPJ pelos dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000180")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });
  it("valida CPF pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
  it("formata documentos, CEP, telefone e CNAE", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCep("18035000")).toBe("18035-000");
    expect(formatPhone("15999998888")).toBe("(15) 99999-8888");
    expect(formatPhone("1533334444")).toBe("(15) 3333-4444");
    expect(formatCnae("7119703")).toBe("7119-7/03");
    expect(onlyDigits("(15) 3333-4444")).toBe("1533334444");
  });
});
