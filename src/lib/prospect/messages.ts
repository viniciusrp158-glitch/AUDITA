/**
 * Mensagens prontas da prospecção (AUDDOC020 Rev.01, RP-10): texto do WhatsApp definido pelo Diretor em 19/11/2026,
 * com o segmento da empresa no lugar de "indústrias" quando ela não é indústria e a linha de saída exigida pelo RP-10.
 * Arquivo puro (sem banco), usado nas telas e nos testes.
 */

/** Como chamar o segmento na frase "Ajudamos ___ a manter…", pelo código do nicho. */
export const SEGMENT_PHRASE: Record<string, string> = {
  industria: "indústrias",
  construcao: "construtoras",
  atacado_logistica: "empresas de logística e distribuição",
  oficinas: "oficinas e reparadoras de veículos",
  combustiveis: "postos de combustíveis",
  residuos: "empresas de coleta e tratamento de resíduos",
};
export const segmentPhrase = (nicheCode: string | null | undefined) => SEGMENT_PHRASE[nicheCode ?? ""] ?? "empresas";

const SUFFIX = /\s+(LTDA\.?|S\/?A\.?|S\.A\.|EIRELI|EPP|ME|SOCIEDADE ANONIMA|LIMITADA)\s*$/i;
const LOWER = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);

/** Nome da empresa como se escreve numa conversa: sem "LTDA", "S/A" etc. e com maiúsculas só no início das palavras. */
export function companyDisplayName(tradeName: string | null | undefined, legalName: string): string {
  let n = (tradeName?.trim() || legalName).replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) n = n.replace(SUFFIX, "").trim();
  if (n !== n.toUpperCase()) return n; // já vem escrito com maiúsculas e minúsculas
  return n
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.length <= 3 && /^[a-z]+$/.test(w) && i === 0 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export const OPT_OUT_LINE = "Se não fizer sentido agora, é só me avisar que não entro mais em contato.";

/** Mensagem padrão do WhatsApp (Diretor, 19/11/2026) + segmento + linha de saída. */
export function whatsappMessage(v: { userName: string; company: string; nicheCode?: string | null }): string {
  return [
    `Olá! Tudo bem? Aqui é ${v.userName}, da AUDITA | SSMA & SGI, de Sorocaba. 👋`,
    `Ajudamos ${segmentPhrase(v.nicheCode)} a manter a Segurança do Trabalho e o Meio Ambiente em dia, com treinamentos normativos (NRs) e consultoria técnica.`,
    "",
    `Posso entender rapidamente as necessidades da ${v.company} e ver como podemos apoiar?`,
    "",
    OPT_OUT_LINE,
  ].join("\n");
}

/** E-mail em texto (enquanto o e-mail de apresentação pelo Brevo não estiver liberado): mesmo conteúdo do WhatsApp. */
export function emailText(v: { userName: string; company: string; nicheCode?: string | null }): { subject: string; body: string } {
  return {
    subject: `AUDITA | SSMA & SGI — Segurança do Trabalho e Meio Ambiente para a ${v.company}`,
    body: [
      "Olá! Tudo bem?",
      "",
      `Aqui é ${v.userName}, da AUDITA | SSMA & SGI, de Sorocaba.`,
      `Ajudamos ${segmentPhrase(v.nicheCode)} a manter a Segurança do Trabalho e o Meio Ambiente em dia, com treinamentos normativos (NRs) e consultoria técnica.`,
      "",
      `Posso entender rapidamente as necessidades da ${v.company} e ver como podemos apoiar?`,
      "",
      "WhatsApp: (15) 99689-1049 · audita.seg.br",
      "",
      `${OPT_OUT_LINE} Basta responder a este e-mail.`,
    ].join("\n"),
  };
}
