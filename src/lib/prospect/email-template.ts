/**
 * E-mail de apresentação da prospecção (AUDDOC020 Rev.01, RP-09; decisão do Diretor de 19/11/2026: "rápido, bonito e
 * eficaz, com imagem e ilustração"). HTML em tabelas e estilos em linha (Outlook, Gmail e celular). Textos: mensagem
 * do Diretor + slogan e resumos das famílias de serviço já aprovados no site (site/src/content). Nada inventado.
 * RASCUNHO PARA APROVAÇÃO DO DIRETOR — o envio em lote só é liberado após a validação jurídica (Rev.01, seção 2).
 */
import { OPT_OUT_LINE, segmentPhrase } from "./messages";

export const EMAIL_ASSETS = "https://audita.seg.br/empresa/brand/email";
const WHATS = "5515996891049";
const NAVY = "#031b35";
const GREEN = "#80bb08";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type PresentationEmail = { subject: string; preheader: string; html: string; text: string };

export function presentationEmail(v: { userName: string; company: string; nicheCode?: string | null; unsubscribeUrl: string }): PresentationEmail {
  const seg = segmentPhrase(v.nicheCode);
  const subject = `${v.company}: Segurança do Trabalho e Meio Ambiente em dia`;
  const preheader = `Treinamentos normativos (NRs) e consultoria técnica para ${seg} — AUDITA | SSMA & SGI, de Sorocaba.`;
  const wa = `https://wa.me/${WHATS}?text=${encodeURIComponent("Olá! Recebi o e-mail da AUDITA e quero conversar.")}`;
  const services: [string, string][] = [
    ["Treinamentos in company", "Treinamentos por turma na sua empresa, DDS, campanhas e ações educativas de SST."],
    ["Documentos e procedimentos", "Ordens de serviço, procedimentos, relatórios de inspeção, PGR/GRO, APR e triagem ergonômica."],
    ["Gestão recorrente de SST", "Suporte periódico em rotinas de SST, sem assumir obrigações do empregador nem substituir SESMT legalmente exigido."],
    ["Meio Ambiente", "Controle documental ambiental, prazos e apoio às rotinas de resíduos."],
  ];
  const text = [
    "Olá! Tudo bem?",
    "",
    `Aqui é ${v.userName}, da AUDITA | SSMA & SGI, de Sorocaba.`,
    `Ajudamos ${seg} a manter a Segurança do Trabalho e o Meio Ambiente em dia, com treinamentos normativos (NRs) e consultoria técnica.`,
    "",
    ...services.map(([t, d]) => `• ${t}: ${d}`),
    "",
    `Posso entender rapidamente as necessidades da ${v.company} e ver como podemos apoiar?`,
    `WhatsApp: (15) 99689-1049 — ${wa}`,
    "Site: https://audita.seg.br",
    "",
    `${OPT_OUT_LINE} Para não receber mais: ${v.unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1d2b3a;">
  <tr><td style="padding:22px 28px 14px;"><img src="${EMAIL_ASSETS}/logo.png" width="150" alt="audita" style="display:block;border:0;width:150px;height:auto;"></td></tr>
  <tr><td><img src="${EMAIL_ASSETS}/topo-sst.jpg" width="600" alt="Técnico da AUDITA em inspeção de segurança numa indústria" style="display:block;border:0;width:100%;max-width:600px;height:auto;"></td></tr>
  <tr><td style="background:${NAVY};padding:18px 28px;">
    <p style="margin:0;font-size:20px;line-height:1.3;font-weight:bold;color:#ffffff;">Gestão inteligente para ambientes mais seguros.</p>
    <p style="margin:6px 0 0;font-size:13px;color:${GREEN};font-weight:bold;letter-spacing:.5px;">AUDITA | SSMA &amp; SGI · SOROCABA/SP</p>
  </td></tr>
  <tr><td style="padding:24px 28px 8px;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 12px;">Olá! Tudo bem?</p>
    <p style="margin:0 0 12px;">Aqui é <strong>${esc(v.userName)}</strong>, da AUDITA | SSMA &amp; SGI, de Sorocaba. Ajudamos <strong>${esc(seg)}</strong> a manter a Segurança do Trabalho e o Meio Ambiente em dia, com treinamentos normativos (NRs) e consultoria técnica.</p>
  </td></tr>
  <tr><td style="padding:4px 20px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${services
        .map(
          ([t, d]) => `<tr><td style="padding:6px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;border-left:4px solid ${GREEN};border-radius:8px;"><tr><td style="padding:12px 14px;">
        <p style="margin:0;font-size:14px;font-weight:bold;color:${NAVY};">${esc(t)}</p>
        <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:#4a5a6b;">${esc(d)}</p>
      </td></tr></table></td></tr>`,
        )
        .join("\n      ")}
    </table>
  </td></tr>
  <tr><td style="padding:16px 28px 4px;font-size:15px;line-height:1.6;">
    <p style="margin:0;">Posso entender rapidamente as necessidades da <strong>${esc(v.company)}</strong> e ver como podemos apoiar?</p>
  </td></tr>
  <tr><td align="center" style="padding:18px 28px 26px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="border-radius:10px;background:#1f9d55;"><a href="${wa}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Conversar pelo WhatsApp</a></td>
      <td width="10"></td>
      <td style="border-radius:10px;border:2px solid ${NAVY};"><a href="https://audita.seg.br" style="display:inline-block;padding:11px 18px;font-size:15px;font-weight:bold;color:${NAVY};text-decoration:none;">Conhecer a AUDITA</a></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f4f7fa;padding:16px 28px;font-size:12px;line-height:1.6;color:#5d6b79;">
    <p style="margin:0;"><strong style="color:${NAVY};">AUDITA | SSMA &amp; SGI</strong> · Sorocaba/SP · (15) 99689-1049 · engenharia.audita@outlook.com · <a href="https://audita.seg.br" style="color:${NAVY};">audita.seg.br</a></p>
    <p style="margin:8px 0 0;">${esc(OPT_OUT_LINE)} <a href="${esc(v.unsubscribeUrl)}" style="color:${NAVY};">Não quero receber mais e-mails</a>. Usamos dados públicos de empresas (Receita Federal) conforme a LGPD — <a href="https://audita.seg.br/privacidade" style="color:${NAVY};">privacidade</a>.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, preheader, html, text };
}
