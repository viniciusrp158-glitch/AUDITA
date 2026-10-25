/**
 * Correções da auditoria de segurança (25/10/2026) — regras puras (sem banco):
 *   10) desfazer da matrícula ("alunos"): só apaga a conta criada pela própria requisição e sem aluno vinculado;
 *   11) entrega de arquivos do aluno: exibição só para PDF/imagem, nosniff e CSP com sandbox;
 *    1) itens da cotação: sem os ajustes de preço, nada de margem/contingência/desconto.
 */
import { describe, expect, it } from "vitest";
import { contaCriadaNestaRequisicao, podeApagarConta } from "../../supabase/functions/alunos/conta-criada";
import { fileResponseHeaders } from "../../aluno/src/lib/arquivo";
import { withItemPricing } from "@/lib/pricing/item-columns";

describe("10) desfazer da matrícula", () => {
  const inicio = Date.parse("2026-10-25T12:00:00.000Z");
  it("conta criada agora conta como desta requisição; conta antiga (convite reaproveitado) não", () => {
    expect(contaCriadaNestaRequisicao("2026-10-25T12:00:00.300Z", inicio)).toBe(true);
    expect(contaCriadaNestaRequisicao("2026-10-25T11:59:59.000Z", inicio)).toBe(true); // folga de relógio (2 s)
    expect(contaCriadaNestaRequisicao("2026-10-25T11:59:50.000Z", inicio)).toBe(false);
    expect(contaCriadaNestaRequisicao("2026-10-20T08:00:00.000Z", inicio)).toBe(false);
    expect(contaCriadaNestaRequisicao(undefined, inicio)).toBe(false);
    expect(contaCriadaNestaRequisicao("data inválida", inicio)).toBe(false);
  });
  it("só apaga se criou E nenhum aluno aponta para a conta", () => {
    expect(podeApagarConta({ criadaNestaRequisicao: true, referenciadaPorAluno: false })).toBe(true);
    expect(podeApagarConta({ criadaNestaRequisicao: true, referenciadaPorAluno: true })).toBe(false);
    expect(podeApagarConta({ criadaNestaRequisicao: false, referenciadaPorAluno: false })).toBe(false);
  });
});

describe("11) cabeçalhos da entrega de arquivos do aluno", () => {
  it("PDF e imagens comuns: exibidos na página, com nosniff e CSP com sandbox", () => {
    for (const t of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
      const h = fileResponseHeaders(t, "apostila.pdf", false);
      expect(h["Content-Type"]).toBe(t);
      expect(h["Content-Disposition"]).toMatch(/^inline;/);
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
      expect(h["Content-Security-Policy"]).toContain("sandbox");
      expect(h["Content-Security-Policy"]).toContain("default-src 'none'");
    }
  });
  it("tipo fora da lista (HTML, SVG, vazio): download genérico, nunca exibido", () => {
    for (const t of ["text/html", "image/svg+xml", "application/xhtml+xml", "", null]) {
      const h = fileResponseHeaders(t, "x.html", false);
      expect(h["Content-Type"]).toBe("application/octet-stream");
      expect(h["Content-Disposition"]).toMatch(/^attachment;/);
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
    }
  });
  it("?baixar=1 sempre como anexo; nome do arquivo codificado", () => {
    const h = fileResponseHeaders("application/pdf", "Apostila M01 — ação.pdf", true);
    expect(h["Content-Disposition"]).toBe(`attachment; filename*=UTF-8''${encodeURIComponent("Apostila M01 — ação.pdf")}`);
  });
});

describe("1) ajustes de preço do item", () => {
  it("sem a consulta do administrador, os campos de preço ficam vazios", () => {
    const [it] = withItemPricing([{ id: "a", description: "Item" }], null);
    expect(it).toMatchObject({ margin: null, contingency: null, discount: null, discount_reason: null, discount_authorized: false });
  });
  it("com a consulta do administrador, junta por item", () => {
    const rows = withItemPricing([{ id: "a" }, { id: "b" }], [
      { item_id: "b", contingency: 0.1, margin: 0.35, discount: 0, discount_reason: null, discount_authorized: false, discount_authorized_at: null, discount_authorized_by: null },
    ]);
    expect(rows[0].margin).toBeNull();
    expect(rows[1]).toMatchObject({ id: "b", margin: 0.35, contingency: 0.1 });
    expect(rows[1]).not.toHaveProperty("item_id");
  });
});
