import { describe, expect, it } from "vitest";
import { describeChange } from "@/lib/clients/labels";

describe("histórico legível", () => {
  it("formata alterações com rótulos e valores brasileiros", () => {
    const lines = describeChange("update", {
      status: { de: "ativo", para: "inativo" },
      inactivated_at: { de: null, para: "2026-10-09T17:41:39Z" },
      tax_id: { de: null, para: "11222333000181" },
    });
    expect(lines).toEqual(["Situação: Ativo → Inativo", "CNPJ/CPF: — → 11.222.333/0001-81"]);
  });
  it("traduz o vínculo de unidade pelo nome", () => {
    const lines = describeChange("insert", { full_name: "Pessoa", unit_id: "u1", is_primary: true }, { unitNames: { u1: "Matriz" } });
    expect(lines).toEqual(["Nome: Pessoa", "Unidade: Matriz", "Contato principal: Sim"]);
  });
});
