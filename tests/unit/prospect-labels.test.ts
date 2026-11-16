/** AUDITA PROSPECT — modelos de mensagem e link do WhatsApp assistido (AUDDOC020 RP-09, RP-10). */
import { describe, expect, it } from "vitest";
import { isMobile, isStage, renderTemplate, STAGES, TEMPLATES, templateForNiche, whatsappLink } from "@/lib/prospect/labels";

describe("etapas", () => {
  it("as 10 etapas do funil, na ordem do planejamento", () => {
    expect(STAGES.map((s) => s.value)).toEqual(["identificada", "importado", "qualificado", "primeiro_contato", "aguardando_retorno", "negociacao", "reuniao", "proposta", "cliente", "perdido"]);
    expect(isStage("negociacao")).toBe(true);
    expect(isStage("ganho")).toBe(false);
  });
});

describe("modelos de mensagem", () => {
  it("todo modelo identifica a AUDITA e oferece saída", () => {
    for (const t of TEMPLATES) {
      expect(t.body).toContain("AUDITA | SSMA & SGI");
      expect(t.body).toContain("{remetente}");
      expect(t.body).toMatch(/não receber contatos/);
    }
  });
  it("preenche empresa e remetente e escolhe o modelo pelo nicho", () => {
    const txt = renderTemplate(templateForNiche("construcao"), { empresa: "[TESTE] Construtora Alfa", remetente: "Vinicius" });
    expect(txt).toContain("Aqui é Vinicius, da AUDITA");
    expect(txt).toContain("obras da [TESTE] Construtora Alfa");
    expect(txt).not.toMatch(/\{(empresa|remetente)\}/);
    expect(templateForNiche(null)).toBe("diagnostico_sst");
  });
});

describe("WhatsApp assistido", () => {
  it("monta o link oficial com país e mensagem codificada", () => {
    expect(whatsappLink("(15) 99123-4567", "Olá & tudo bem?")).toBe("https://wa.me/5515991234567?text=Ol%C3%A1%20%26%20tudo%20bem%3F");
    expect(whatsappLink("5515991234567", "x")).toBe("https://wa.me/5515991234567?text=x");
  });
  it("recusa número inválido e distingue celular de fixo", () => {
    expect(whatsappLink("1234", "x")).toBeNull();
    expect(whatsappLink(null, "x")).toBeNull();
    expect(isMobile("15991234567")).toBe(true);
    expect(isMobile("1533334444")).toBe(false);
  });
});
