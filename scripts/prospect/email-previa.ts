import fs from "node:fs";
import { presentationEmail } from "@/lib/prospect/email-template";
const e = presentationEmail({ userName: "Vinicius", company: "Metalúrgica Exemplo", nicheCode: "industria", unsubscribeUrl: "https://audita.seg.br/empresa/descadastro?t=EXEMPLO" });
// Na prévia local as imagens vêm da pasta do projeto (ainda não publicadas)
// As imagens já ficam públicas em audita.seg.br/empresa/brand/email (publicadas com o sistema)
const local = e.html;
fs.writeFileSync("docs/prospeccao/email-apresentacao-previa.html", local);
console.log(e.subject, "|", e.preheader);
