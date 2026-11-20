/**
 * Monta o e-mail de apresentação de TESTE (para o próprio Diretor) em JSON: assunto marcado [TESTE], empresa fictícia
 * identificada como teste e link de descadastro com código inexistente (não descadastra ninguém).
 * Uso: npx tsx scripts/prospect/email-teste-payload.ts <arquivo-saida.json>
 */
import fs from "node:fs";
import { presentationEmail } from "@/lib/prospect/email-template";

const out = process.argv[2];
if (!out) throw new Error("Informe o arquivo de saída");
const e = presentationEmail({
  userName: "Vinicius",
  company: "Empresa de Teste",
  nicheCode: "industria",
  unsubscribeUrl: `https://audita.seg.br/empresa/descadastro?t=${"0".repeat(48)}`,
});
fs.writeFileSync(out, JSON.stringify({ subject: `[TESTE] ${e.subject}`, html: e.html, text: e.text }));
console.log("Assunto:", `[TESTE] ${e.subject}`);
