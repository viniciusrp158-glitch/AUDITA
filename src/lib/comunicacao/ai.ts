/**
 * C1 — Agente de IA das artes da Comunicação (D-08 decidida pelo Diretor em 27/10/2026).
 * Claude (Anthropic) desenha a arte em SVG a partir do pedido escrito por quem cria a peça, dentro da identidade do
 * AUDDOC003. A chave fica só no servidor (ANTHROPIC_API_KEY); o logo oficial e o rodapé são aplicados pelo sistema
 * (render.ts), nunca desenhados pela IA; o resultado sempre passa pela revisão humana do I10 antes de exportar.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BRANDS, PALETTE, SIGNATURE, SLOGAN, TEMPLATES, type Brand, type Template } from "./labels";
import { artArea } from "./art-layout";

export const AI_MODEL = process.env.AUDITA_IA_MODELO || "claude-opus-5-5";

/** A IA está configurada neste servidor? (sem a chave, a tela explica como ligar). */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ArtResult = {
  title: string;
  subtitle: string | null;
  body: string | null;
  cta: string | null;
  caption: string | null;
  alt_text: string;
  svg: string;
};

const resultSchema = z.object({
  title: z.string().trim().min(3).max(90),
  subtitle: z.string().trim().max(160).nullable(),
  body: z.string().trim().max(700).nullable(),
  cta: z.string().trim().max(60).nullable(),
  caption: z.string().trim().max(2200).nullable(),
  alt_text: z.string().trim().min(3).max(500),
  svg: z.string().min(50).max(400000),
});

// Esquema enviado à API (saída estruturada): o JSON sempre volta com estes campos
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "body", "cta", "caption", "alt_text", "svg"],
  properties: {
    title: { type: "string", description: "Título principal que aparece na arte (até 90 caracteres)." },
    subtitle: { type: ["string", "null"], description: "Subtítulo da arte, se houver (até 160 caracteres)." },
    body: { type: ["string", "null"], description: "Texto de apoio que aparece na arte, se houver (até 700 caracteres)." },
    cta: { type: ["string", "null"], description: "Chamada para ação da arte, se houver (até 60 caracteres)." },
    caption: { type: ["string", "null"], description: "Legenda sugerida para a publicação na rede social (até 2.200 caracteres)." },
    alt_text: { type: "string", description: "Descrição da imagem para acessibilidade (até 500 caracteres)." },
    svg: { type: "string", description: "A arte completa em SVG, começando por <svg." },
  },
} as const;

export type ArtContext = {
  brand: Brand;
  template: Template;
  channel: string;
  theme: string;
  objective: string | null;
  audience: string | null;
  service: { service_code: string; name: string; commercial_status: string; scope: string } | null;
  campaign: string | null;
  instruction: string;
  /** Imagens anexadas ao pedido (já reduzidas). `background` = vira a foto de fundo da área da arte. */
  references?: { mime: "image/png" | "image/jpeg"; base64: string; background: boolean }[];
  /** A arte tem foto de fundo (nova ou mantida do ajuste anterior)? */
  hasBackground?: boolean;
  /** Ajuste de uma arte existente: os textos e o SVG atuais. */
  current?: { title: string | null; subtitle: string | null; body: string | null; cta: string | null; svg: string } | null;
};

function systemPrompt(): string {
  return `Você é o designer gráfico da AUDITA, empresa brasileira de consultoria em SSMA (Segurança, Saúde e Meio Ambiente) e SGI (sistemas de gestão integrados). Você cria artes para redes sociais e comunicação institucional da AUDITA e das suas plataformas Audita PRO e Audita HUB, seguindo o Manual de Identidade Visual (AUDDOC003). Escreva sempre em português do Brasil, com acentuação correta.

Identidade visual (AUDDOC003):
- Paleta aprovada: azul-marinho ${PALETTE.navy} (cor institucional, textos e blocos), verde AUDITA ${PALETTE.green}, azul Audita PRO ${PALETTE.pro}, verde Audita HUB ${PALETTE.hub}, cinza claro ${PALETTE.light}, cinza ${PALETTE.gray} e branco. A cor de destaque é a da marca da peça; as cores do PRO e do HUB nunca se trocam entre si nem aparecem na peça da outra marca.
- Fundo branco ou cinza claro preferencial; blocos azul-marinho são bem-vindos; destaque da marca em detalhes (linhas, formas, ícones). Visual limpo, profissional, técnico e confiável, sem poluição.
- Tipografia: somente font-family="Montserrat", com font-weight 400, 600 ou 700 (títulos em 700).
- Ilustrações vetoriais planas (flat) desenhadas por você com formas SVG: pessoas estilizadas sem rosto detalhado, EPIs, equipamentos, ícones, cenários de trabalho. Nada de fotografia, de texto em inglês ou de marcas de terceiros.

Regras obrigatórias:
- NÃO desenhe nem imite o logo da AUDITA, do Audita PRO ou do Audita HUB: o logo oficial é aplicado pelo sistema numa faixa branca acima da sua arte, e a assinatura "${SIGNATURE}", o slogan "${SLOGAN}" e os contatos oficiais vão num rodapé azul-marinho abaixo dela. A sua arte é só a área entre essas faixas.
- Não invente contatos, telefones, sites, endereços, preços, datas, carga horária, vagas ou números que o pedido não trouxer.
- Tom de voz (AUDDOC003 §11): nunca prometa "zero multas", "certificação garantida", "100%", "garantimos" ou resultados; não sugira acreditação nem certificação; não ofereça laudos ou ART. Para treinamentos de NR, não prometa certificado que substitua exigência legal além do que o serviço do catálogo indica.
- Pouco texto na arte: título forte e curto, no máximo um subtítulo e uma chamada; o restante vai para a legenda. Todo texto da arte precisa caber na área: considere que cada caractere em Montserrat ocupa cerca de 0,6 vezes o tamanho da fonte e quebre as linhas com <tspan>. Margem interna mínima de 6% da largura.
- SVG autocontido e válido: raiz <svg xmlns="http://www.w3.org/2000/svg" width="LARGURA" height="ALTURA" viewBox="0 0 LARGURA ALTURA">, sem <image>, sem <script>, sem <foreignObject>, sem links, sem fontes externas, sem CSS @import e sem atributos de evento. Gradientes, máscaras e recortes são permitidos.
- Os campos title, subtitle, body e cta devem conter exatamente os textos que aparecem na arte (null quando não houver).

Imagens anexadas:
- "Referência de estilo": reproduza a composição, o ritmo das formas, a hierarquia e o clima da imagem dentro da identidade acima (não copie textos, marcas ou logos dela; tudo em vetor).
- "Foto de fundo": o sistema coloca essa foto preenchendo toda a área da arte (recortada a partir do centro) e desenha o seu SVG por cima. Nesse caso o SVG NÃO pode ter fundo: deixe a maior parte transparente para a foto aparecer, mantenha as pessoas e o assunto principal visíveis e desenhe só faixas, formas geométricas nas cores da marca (opacas ou semitransparentes) e os textos. Todo texto sobre a foto precisa de um bloco sólido ou de uma faixa escura/clara atrás para ter contraste.`;
}

function userContent(c: ArtContext): Anthropic.Beta.Messages.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  (c.references ?? []).forEach((r, i) => {
    blocks.push({ type: "text", text: `Imagem ${i + 1}: ${r.background ? "foto de fundo da arte" : "referência de estilo"}.` });
    blocks.push({ type: "image", source: { type: "base64", media_type: r.mime, data: r.base64 } });
  });
  blocks.push({ type: "text", text: userPrompt(c) });
  return blocks;
}

function userPrompt(c: ArtContext): string {
  const area = artArea(c.template);
  const t = TEMPLATES[c.template];
  const lines = [
    `Marca da peça: ${BRANDS[c.brand].label} (cor de destaque ${BRANDS[c.brand].accent}).`,
    `Formato: ${t.label} (${t.size}), canal ${c.channel}. A sua arte ocupa a área de ${area.width} × ${area.height} px (use exatamente essa largura e altura no SVG).`,
    `Tema: ${c.theme}.`,
    c.objective ? `Objetivo: ${c.objective}.` : null,
    c.audience ? `Público: ${c.audience}.` : null,
    c.campaign ? `Campanha: ${c.campaign}.` : null,
    c.service
      ? `Serviço do catálogo: ${c.service.service_code} — ${c.service.name} (situação: ${c.service.commercial_status}).${c.service.scope ? `\nEscopo e limites do catálogo (respeite; não prometa além disso):\n${c.service.scope}` : ""}`
      : null,
    c.hasBackground
      ? "Esta arte tem FOTO DE FUNDO aplicada pelo sistema: o seu SVG não pode ter retângulo de fundo; só formas e textos por cima, com contraste."
      : null,
  ].filter(Boolean);
  if (c.current) {
    return `${lines.join("\n")}

Esta é a arte atual da peça (textos: título "${c.current.title ?? ""}", subtítulo "${c.current.subtitle ?? ""}", texto "${c.current.body ?? ""}", chamada "${c.current.cta ?? ""}"):
<arte_atual>
${c.current.svg}
</arte_atual>

Ajuste pedido (mantenha o que não foi pedido para mudar):
<pedido>
${c.instruction}
</pedido>`;
  }
  return `${lines.join("\n")}

Pedido de quem está criando a peça (descreva na arte exatamente o que foi pedido):
<pedido>
${c.instruction}
</pedido>`;
}

/** Remove qualquer conteúdo ativo ou referência externa (o SVG só é renderizado no servidor, mas fica limpo mesmo assim). */
export function sanitizeSvg(svg: string): string {
  let s = svg.trim().replace(/^<\?xml[^>]*>\s*/i, "").replace(/<!DOCTYPE[^>]*>\s*/i, "");
  s = s
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<(iframe|object|embed)[\s\S]*?(<\/\1\s*>|\/>)/gi, "")
    .replace(/<image\b[^>]*\/>/gi, "")
    .replace(/<image\b[\s\S]*?<\/image\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none")
    .replace(/javascript:/gi, "");
  if (!/^<svg[\s>]/i.test(s)) throw new Error("A IA não devolveu um SVG válido.");
  return s;
}

/** Ajusta o tamanho declarado do SVG para a área da arte (a IA às vezes erra largura ou altura). */
function fixSize(svg: string, w: number, h: number): string {
  return svg.replace(/^<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const hasViewBox = /\sviewBox\s*=/i.test(attrs);
    const cleaned = attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    return `<svg${cleaned} width="${w}" height="${h}"${hasViewBox ? "" : ` viewBox="0 0 ${w} ${h}"`}>`;
  });
}

export type ArtCallResult = { ok: true; result: ArtResult; model: string; usage: Record<string, unknown> } | { ok: false; error: string; model: string; usage?: Record<string, unknown> };

export async function generateArt(c: ArtContext): Promise<ArtCallResult> {
  if (!aiConfigured()) return { ok: false, error: "IA não configurada no servidor (falta a chave ANTHROPIC_API_KEY).", model: AI_MODEL };
  const client = new Anthropic({ timeout: 9 * 60_000, maxRetries: 1 });
  let message: Anthropic.Beta.Messages.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 48_000,
      // Se um filtro de segurança recusar por engano, a própria API repete o pedido num modelo alternativo
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: systemPrompt(),
      messages: [{ role: "user", content: userContent(c) }],
    });
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "A chave da IA foi recusada pela Anthropic; confira a ANTHROPIC_API_KEY.", model: AI_MODEL };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Limite de uso da IA atingido; tente de novo em alguns minutos.", model: AI_MODEL };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `A IA respondeu com erro (${e.status ?? "sem código"}). Tente de novo.`, model: AI_MODEL };
    return { ok: false, error: "Não foi possível falar com a IA (conexão). Tente de novo.", model: AI_MODEL };
  }
  const usage = { ...(message.usage as unknown as Record<string, unknown>), served_by: message.model };
  if (message.stop_reason === "refusal") return { ok: false, error: "A IA recusou este pedido. Reescreva a descrição e tente de novo.", model: message.model, usage };
  if (message.stop_reason === "max_tokens") return { ok: false, error: "A arte ficou grande demais e foi cortada. Peça algo mais simples.", model: message.model, usage };
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: z.infer<typeof resultSchema>;
  try {
    parsed = resultSchema.parse(JSON.parse(text));
  } catch {
    return { ok: false, error: "A IA devolveu uma resposta fora do formato esperado. Tente de novo.", model: message.model, usage };
  }
  let svg: string;
  try {
    const area = artArea(c.template);
    svg = fixSize(sanitizeSvg(parsed.svg), area.width, area.height);
  } catch (e) {
    return { ok: false, error: (e as Error).message, model: message.model, usage };
  }
  return {
    ok: true,
    model: message.model,
    usage,
    result: {
      title: parsed.title,
      subtitle: parsed.subtitle || null,
      body: parsed.body || null,
      cta: parsed.cta || null,
      caption: parsed.caption || null,
      alt_text: parsed.alt_text,
      svg,
    },
  };
}

/** Textos dentro do SVG (para os avisos de tom de voz da revisão). */
export function svgTexts(svg: string): string {
  return [...svg.matchAll(/<(text|tspan)\b[^>]*>([^<]*)</gi)].map((m) => m[2]).join(" ").replace(/\s+/g, " ").trim();
}
