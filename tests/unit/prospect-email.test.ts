/** E-mail de apresentação da prospecção (AUDDOC020 Rev.01, RP-09): conteúdo aprovado, segmento, saída e segurança. */
import { describe, expect, it } from "vitest";
import { EMAIL_ASSETS, presentationEmail } from "@/lib/prospect/email-template";
import { OPT_OUT_LINE } from "@/lib/prospect/messages";

describe("E-mail de apresentação", () => {
  const e = presentationEmail({ userName: "Vinicius", company: "Metalúrgica Exemplo", nicheCode: "industria", unsubscribeUrl: "https://audita.seg.br/empresa/descadastro?t=abc" });
  it("assunto, texto do Diretor, segmento, empresa e serviços aprovados", () => {
    expect(e.subject).toBe("Metalúrgica Exemplo: Segurança do Trabalho e Meio Ambiente em dia");
    expect(e.html).toContain("Ajudamos <strong>indústrias</strong> a manter a Segurança do Trabalho e o Meio Ambiente em dia");
    expect(e.html).toContain("Gestão inteligente para ambientes mais seguros.");
    for (const t of ["Treinamentos in company", "Documentos e procedimentos", "Gestão recorrente de SST", "Meio Ambiente"]) expect(e.html).toContain(t);
    expect(e.text).toContain("Posso entender rapidamente as necessidades da Metalúrgica Exemplo");
  });
  it("saída, descadastro, privacidade, WhatsApp oficial e imagens públicas do domínio", () => {
    expect(e.html).toContain(OPT_OUT_LINE);
    expect(e.html).toContain('href="https://audita.seg.br/empresa/descadastro?t=abc"');
    expect(e.text).toContain("https://audita.seg.br/empresa/descadastro?t=abc");
    expect(e.html).toContain("https://audita.seg.br/privacidade");
    expect(e.html).toContain("https://wa.me/5515996891049?text=");
    expect(e.html).toContain(`${EMAIL_ASSETS}/topo-sst.jpg`);
    expect(EMAIL_ASSETS.startsWith("https://audita.seg.br/")).toBe(true);
  });
  it("escapa o nome da empresa (sem HTML injetado)", () => {
    const x = presentationEmail({ userName: "V", company: '<script>alert("x")</script> & Cia', unsubscribeUrl: "https://audita.seg.br/empresa/descadastro?t=1" });
    expect(x.html).not.toContain("<script>");
    expect(x.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Cia");
  });
});
