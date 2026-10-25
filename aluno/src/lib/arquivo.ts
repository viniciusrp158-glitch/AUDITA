/**
 * Cabeçalhos da entrega de arquivos do aluno (auditoria de segurança, 25/10/2026). O tipo gravado no banco não decide
 * sozinho como o navegador trata o arquivo: só PDF e imagens comuns são exibidos na página; qualquer outro tipo sai
 * como download genérico. Toda resposta leva nosniff e uma CSP que isola o arquivo (sem scripts, sem a origem do site).
 */
export const INLINE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

export function fileResponseHeaders(mimeType: string | null | undefined, originalName: string, download: boolean): Record<string, string> {
  const type = (mimeType ?? "").trim().toLowerCase();
  const inlineOk = (INLINE_TYPES as readonly string[]).includes(type);
  const asInline = inlineOk && !download;
  return {
    "Content-Type": inlineOk ? type : "application/octet-stream",
    "Content-Disposition": `${asInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    // O leitor da apostila busca o PDF por fetch (pdf.js), que não é afetado por esta política; aberto direto, o arquivo
    // fica numa origem opaca, sem scripts
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
