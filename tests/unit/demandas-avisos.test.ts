import { describe, expect, it } from "vitest";
import { WAITING_LIMIT_HOURS, waitingCutoffIso, waitingHours, waitingLabel } from "@/lib/demands/labels";
import { serviceScopeText } from "@/lib/services/scope";

const H = 3_600_000;
const now = Date.parse("2026-10-27T15:00:00Z");

describe("aviso de demanda em 'Aguardando cliente' há mais de 48 h", () => {
  it("só avisa a partir de 48 h e só nessa situação", () => {
    const at = (h: number) => new Date(now - h * H).toISOString();
    expect(waitingHours({ status: "aguardando_cliente", status_changed_at: at(47.9) }, now)).toBeNull();
    expect(waitingHours({ status: "aguardando_cliente", status_changed_at: at(48) }, now)).toBe(48);
    expect(waitingHours({ status: "aguardando_cliente", status_changed_at: at(80) }, now)).toBe(80);
    expect(waitingHours({ status: "em_analise", status_changed_at: at(200) }, now)).toBeNull();
  });

  it("o corte da consulta é exatamente 48 h antes", () => {
    expect(Date.parse(waitingCutoffIso(now))).toBe(now - WAITING_LIMIT_HOURS * H);
  });

  it("mostra horas até 2 dias e dias a partir daí", () => {
    expect(waitingLabel(49)).toBe("Aguardando há 49 h");
    expect(waitingLabel(50)).toBe("Aguardando há 50 h");
    expect(waitingLabel(73)).toBe("Aguardando há 3 dias");
  });
});

describe("escopo do serviço do catálogo", () => {
  it("monta o texto sem repetir campos iguais e ignora os vazios", () => {
    const t = serviceScopeText({
      service_code: "TRN-NR35",
      name: "Trabalho em altura",
      scope_preliminary: "Presencial obrigatória",
      scope_limits: "Verificar infraestrutura",
      modality: "Presencial obrigatória",
      evidence_required: "  ",
      legal_reference: "NR-35",
    });
    expect(t).toBe(
      "TRN-NR35 — Trabalho em altura (catálogo AUDDOC004/005)\n" +
        "Escopo preliminar: Presencial obrigatória\n" +
        "Limites e condições: Verificar infraestrutura\n" +
        "Referência legal: NR-35",
    );
  });

  it("sem nenhum campo de escopo devolve vazio (não sobrescreve a descrição)", () => {
    expect(
      serviceScopeText({ service_code: "X", name: "Y", scope_preliminary: null, scope_limits: "", modality: null, evidence_required: null, legal_reference: null }),
    ).toBe("");
  });
});
