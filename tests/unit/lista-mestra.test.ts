import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { fingerprintNote, masterFingerprint, renderMasterListDocx, type MasterListData } from "@/lib/library/master-list-doc";

const base: MasterListData = {
  services: [
    { service_code: "TRN-NR35", kind: "oferta", name: "Trabalho em altura", family: "Treinamento", modality: "Presencial", legal_reference: "NR-35", billing_unit_ref: null, pricing_model: "hora_tecnica", commercial_status: "apto_comercialmente", catalog_status: "ativo", updated_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
    { service_code: "ESP-001", kind: "servico", name: "LTCAT — emissão do laudo", family: "Laudo especializado", modality: null, legal_reference: null, billing_unit_ref: null, pricing_model: "hora_tecnica", commercial_status: "nao_liberado", catalog_status: "ativo", updated_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z" },
  ],
  courses: [
    { course_code: "L02", title: "Fundamentos de EPI e Proteção Coletiva", status: "ativo", price: null, access_days: null, version_label: null, workload_minutes: null, updated_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", published_at: null },
  ],
};

describe("Lista Mestra de Serviços e Treinamentos (AUDDOC019)", () => {
  it("a impressão digital muda com o conteúdo e não com a data de alteração", () => {
    const fp = masterFingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    const touched = { ...base, services: base.services.map((s) => ({ ...s, updated_at: "2026-10-27T10:00:00Z" })) };
    expect(masterFingerprint(touched)).toBe(fp);
    const released = { ...base, services: base.services.map((s) => ({ ...s, commercial_status: "apto_comercialmente" as const })) };
    expect(masterFingerprint(released)).not.toBe(fp);
  });

  it("a observação da revisão guarda a impressão digital para a comparação", () => {
    expect(fingerprintNote("0123456789abcdef", ["TRN-NR35 — Trabalho em altura (alterado)"])).toContain("Impressão digital: 0123456789abcdef.");
  });

  it("gera o Word com as seções e sem preço inventado (PENDENTE)", async () => {
    const buf = await renderMasterListDocx(base, { revision: "Rev.00", approvedBy: "Diretor (teste)", approvedOn: "2026-10-27", fingerprint: masterFingerprint(base) });
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    expect(xml).toContain("1. Serviços liberados para orçamento (1)");
    expect(xml).toContain("TRN-NR35");
    expect(xml).toContain("3. Serviços ainda não liberados (1) — não orçar");
    expect(xml).toContain("PENDENTE");
    expect(xml).toContain("Sem versão publicada");
  });
});
