/**
 * Dados de apresentação da Audita Academy que não ficam no banco (planejamento aprovado pelo Diretor, 16/11/2026).
 * Capa e área de cada curso, pelo código. Curso sem capa usa a padrão; curso sem área não mostra o selo.
 */
const CAPAS: Record<string, string> = { L01: "l01.webp" };
const AREAS: Record<string, string> = { L01: "SST" };

export const capaDoCurso = (code: string) => `/treinamentos/capas/${CAPAS[code.toUpperCase()] ?? "padrao.webp"}`;
export const areaDoCurso = (code: string): string | null => AREAS[code.toUpperCase()] ?? null;

/** WhatsApp da AUDITA (o mesmo do site institucional, site/src/content/empresa.ts). */
export const WHATSAPP = "5515996891049";
export const whatsapp = (mensagem: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
