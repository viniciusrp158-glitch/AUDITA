/** Mensagens da prospecção (AUDDOC020 Rev.01, RP-10): texto do Diretor, segmento, linha de saída e nome da empresa. */
import { describe, expect, it } from "vitest";
import { companyDisplayName, emailText, OPT_OUT_LINE, whatsappMessage } from "@/lib/prospect/messages";

describe("Mensagens da prospecção", () => {
  it("WhatsApp: texto do Diretor com nome do usuário, empresa, segmento e linha de saída", () => {
    const m = whatsappMessage({ userName: "Vinicius", company: "Alfa Esquadrias", nicheCode: "industria" });
    expect(m).toBe(
      "Olá! Tudo bem? Aqui é Vinicius, da AUDITA | SSMA & SGI, de Sorocaba. 👋\n" +
        "Ajudamos indústrias a manter a Segurança do Trabalho e o Meio Ambiente em dia, com treinamentos normativos (NRs) e consultoria técnica.\n\n" +
        "Posso entender rapidamente as necessidades da Alfa Esquadrias e ver como podemos apoiar?\n\n" +
        OPT_OUT_LINE,
    );
    expect(whatsappMessage({ userName: "V", company: "X", nicheCode: "construcao" })).toContain("Ajudamos construtoras a manter");
    expect(whatsappMessage({ userName: "V", company: "X", nicheCode: null })).toContain("Ajudamos empresas a manter");
  });
  it("nome da empresa como se escreve numa conversa", () => {
    expect(companyDisplayName(null, "ALBR ESQUADRIAS EM ALUMINIO LTDA")).toBe("Albr Esquadrias em Aluminio");
    expect(companyDisplayName("CONSTRUTORA DO VALE", "X LTDA")).toBe("Construtora do Vale");
    expect(companyDisplayName(null, "METALURGICA BETA S/A")).toBe("Metalurgica Beta");
    expect(companyDisplayName("Gama Logística", "GAMA LTDA")).toBe("Gama Logística");
  });
  it("e-mail em texto com o mesmo conteúdo e o WhatsApp da AUDITA", () => {
    const e = emailText({ userName: "Vinicius", company: "Alfa", nicheCode: "oficinas" });
    expect(e.subject).toContain("Alfa");
    expect(e.body).toContain("Ajudamos oficinas e reparadoras de veículos");
    expect(e.body).toContain("(15) 99689-1049");
    expect(e.body).toContain(OPT_OUT_LINE);
  });
});
