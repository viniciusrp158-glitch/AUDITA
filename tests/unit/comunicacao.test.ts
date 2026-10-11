/**
 * I10 — Peças de comunicação: desenho dos 5 modelos (PNG/PDF), regras de texto do AUDDOC003 §11 e utilitários.
 * Conteúdo fictício de teste. As imagens geradas ficam em test-results/pecas para conferência visual.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lengthWarnings, TEMPLATE_KEYS, TEMPLATES, textWarnings } from "@/lib/comunicacao/labels";
import { contactsLine, pngSize, renderPiecePdf, renderPiecePng, type PieceRenderInput } from "@/lib/comunicacao/render";

const logoBuf = readFileSync("public/brand/audita-logo.png");
const size = pngSize(logoBuf)!;
const LOGO = { dataUri: `data:image/png;base64,${logoBuf.toString("base64")}`, ...size };

const BASE: PieceRenderInput = {
  template: "post_quadrado",
  brand: "audita",
  title: "[TESTE] Integração de SST para novos colaboradores",
  subtitle: "Orientações iniciais claras, registradas e rastreáveis.",
  body: "Texto fictício de teste: a integração apresenta riscos do ambiente, regras de conduta e canais de comunicação.",
  cta: "Fale com a AUDITA",
  showSlogan: true,
  showContacts: true,
  contacts: { email: "contato@exemplo.test", phone: "15999990000", website: "www.exemplo.test" },
  logo: LOGO,
  watermark: true,
};

describe("I10 — renderização das peças", () => {
  it("lê as dimensões do PNG pelo cabeçalho", () => {
    expect(size.width).toBeGreaterThan(0);
    expect(pngSize(Buffer.from("não é png"))).toBeNull();
  });

  it("gera os 5 modelos no tamanho certo, com e sem logo, e o PDF correspondente", async () => {
    mkdirSync("test-results/pecas", { recursive: true });
    for (const template of TEMPLATE_KEYS) {
      const png = await renderPiecePng({ ...BASE, template, brand: template === "capa_apresentacao" ? "pro" : template === "story" ? "hub" : "audita" });
      expect(pngSize(png), template).toEqual({ width: TEMPLATES[template].width, height: TEMPLATES[template].height });
      writeFileSync(`test-results/pecas/${template}.png`, png);
      const pdf = await renderPiecePdf(png, template, { title: "[TESTE]", subject: "COM-TESTE v1" });
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      if (template === "comunicado_a4") writeFileSync(`test-results/pecas/${template}.pdf`, pdf);
    }
    const pending = await renderPiecePng({ ...BASE, logo: null, contacts: null, watermark: false });
    writeFileSync("test-results/pecas/post_sem_logo.png", pending);
    expect(pngSize(pending)).toEqual({ width: 1080, height: 1080 });
  }, 60_000);

  it("contatos só dos dados oficiais, formatados", () => {
    expect(contactsLine(BASE.contacts)).toBe("www.exemplo.test  ·  contato@exemplo.test  ·  (15) 99999-0000");
    expect(contactsLine(null)).toBeNull();
    expect(contactsLine({ email: null, phone: null, website: null })).toBeNull();
  });

  it("avisos de tom de voz (AUDDOC003 §11) e de excesso de texto por modelo", () => {
    expect(textWarnings("Com a AUDITA, zero multas e certificação garantida!")).toHaveLength(2);
    expect(textWarnings("Garantimos 100% de conformidade")).toHaveLength(2);
    expect(textWarnings("Acompanhamento contínuo das rotinas de SST.")).toEqual([]);
    expect(lengthWarnings("post_quadrado", { title: "x".repeat(71) })).toEqual([
      "Título com 71 caracteres; para Post quadrado use até 70.",
    ]);
    expect(lengthWarnings("comunicado_a4", { title: "x".repeat(71), body: "y".repeat(700) })).toEqual([]);
  });
});
