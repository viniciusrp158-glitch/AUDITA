/**
 * I10 — Comunicação sem IA: modelos, marcas, canais e regras de texto (AUDDOC017 RF-25 a RF-28; AUDDOC003 §03, §04, §11).
 * Módulo sem dependências de servidor (usado também nos formulários).
 */

export type Template = "post_quadrado" | "post_retrato" | "story" | "capa_apresentacao" | "comunicado_a4";
export type Brand = "audita" | "pro" | "hub";
export type Channel = "instagram" | "linkedin" | "whatsapp" | "email" | "site" | "apresentacao" | "impresso" | "outro";
export type PieceStatus = "rascunho" | "em_revisao" | "aprovada" | "cancelada";
export type VersionStatus = "em_revisao" | "aprovada" | "devolvida" | "substituida";
export type CampaignStatus = "planejada" | "ativa" | "encerrada" | "cancelada";
export type AssetVariant = "original_png" | "png_transparente" | "vetor" | "pdf_vetorial" | "aplicacao" | "outro";
export type AssetVersionStatus = "rascunho" | "aprovado" | "substituido" | "cancelado";

/** Limites por modelo: menos texto nos cards de redes sociais (AUDDOC003 §11 — "evitar excesso de texto no card"). */
export const TEMPLATES: Record<
  Template,
  { label: string; size: string; width: number; height: number; use: string; limits: { title: number; subtitle: number; body: number; cta: number } }
> = {
  post_quadrado: {
    label: "Post quadrado",
    size: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    use: "Feed do LinkedIn e do Instagram.",
    limits: { title: 70, subtitle: 120, body: 260, cta: 40 },
  },
  post_retrato: {
    label: "Post retrato (4:5)",
    size: "1080 × 1350 px",
    width: 1080,
    height: 1350,
    use: "Feed do Instagram e do LinkedIn com mais área vertical.",
    limits: { title: 80, subtitle: 140, body: 360, cta: 40 },
  },
  story: {
    label: "Story / status",
    size: "1080 × 1920 px",
    width: 1080,
    height: 1920,
    use: "Stories do Instagram e status do WhatsApp Business.",
    limits: { title: 70, subtitle: 120, body: 240, cta: 40 },
  },
  capa_apresentacao: {
    label: "Capa de apresentação (16:9)",
    size: "1920 × 1080 px",
    width: 1920,
    height: 1080,
    use: "Capa de apresentação, portfólio e banner (AUDDOC003 §11: logo, título de SSMA/SGI e slogan).",
    limits: { title: 90, subtitle: 160, body: 200, cta: 60 },
  },
  comunicado_a4: {
    label: "Comunicado (A4)",
    size: "A4 retrato (1240 × 1754 px)",
    width: 1240,
    height: 1754,
    use: "Comunicado institucional para e-mail, impressão ou PDF.",
    limits: { title: 90, subtitle: 160, body: 700, cta: 60 },
  },
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as Template[];

/** Paleta aprovada (AUDDOC003 §03). As cores PRO e HUB não se trocam entre si. */
export const PALETTE = {
  navy: "#031B35",
  green: "#80BB08",
  pro: "#0296FD",
  hub: "#4A9F1A",
  light: "#F3F4F6",
  gray: "#66758A",
  white: "#FFFFFF",
} as const;

export const BRANDS: Record<Brand, { label: string; accent: string; endorsement: string | null }> = {
  audita: { label: "AUDITA", accent: PALETTE.green, endorsement: null },
  pro: { label: "Audita PRO", accent: PALETTE.pro, endorsement: "Audita PRO — Uma solução AUDITA" },
  hub: { label: "Audita HUB", accent: PALETTE.hub, endorsement: "Audita HUB — Uma solução AUDITA" },
};
export const BRAND_KEYS = Object.keys(BRANDS) as Brand[];

export const SLOGAN = "Gestão inteligente para ambientes mais seguros.";
export const SIGNATURE = "AUDITA | SSMA & SGI";

export const CHANNELS: Record<Channel, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp Business",
  email: "E-mail",
  site: "Site",
  apresentacao: "Apresentação",
  impresso: "Impresso",
  outro: "Outro",
};

export const PIECE_STATUS: Record<PieceStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-surface text-muted" },
  em_revisao: { label: "Em revisão", cls: "bg-warn/10 text-warn" },
  aprovada: { label: "Aprovada", cls: "bg-ok/10 text-ok" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
};
export const VERSION_STATUS: Record<VersionStatus, { label: string; cls: string }> = {
  em_revisao: { label: "Aguardando revisão", cls: "bg-warn/10 text-warn" },
  aprovada: { label: "Aprovada — exportação liberada", cls: "bg-ok/10 text-ok" },
  devolvida: { label: "Devolvida para ajuste", cls: "bg-danger/10 text-danger" },
  substituida: { label: "Substituída", cls: "bg-surface text-muted" },
};
export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; cls: string }> = {
  planejada: { label: "Planejada", cls: "bg-surface text-muted" },
  ativa: { label: "Ativa", cls: "bg-ok/10 text-ok" },
  encerrada: { label: "Encerrada", cls: "bg-surface text-muted" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
};
export const ASSET_VARIANTS: Record<AssetVariant, { label: string; hint: string }> = {
  original_png: { label: "PNG original", hint: "Matriz fornecida pela AUDITA; preservar sem sobrescrever (AUDDOC003 §12)." },
  png_transparente: { label: "PNG transparente", hint: "Derivado fiel, com recorte e transparência validados." },
  vetor: { label: "SVG vetorial", hint: "Vetorização fiel, revisada e homologada." },
  pdf_vetorial: { label: "PDF vetorial", hint: "Para impressão." },
  aplicacao: { label: "Aplicação / modelo", hint: "Peça pronta ou modelo aprovado." },
  outro: { label: "Outro", hint: "Outro arquivo de marca." },
};
export const ASSET_VERSION_STATUS: Record<AssetVersionStatus, { label: string; cls: string }> = {
  rascunho: { label: "Aguardando aprovação", cls: "bg-warn/10 text-warn" },
  aprovado: { label: "Aprovado", cls: "bg-ok/10 text-ok" },
  substituido: { label: "Substituído", cls: "bg-surface text-muted" },
  cancelado: { label: "Cancelado", cls: "bg-surface text-muted line-through" },
};

/** Itens da revisão de marca e texto (FL-04; AUDDOC003 §06 e §11). Todos obrigatórios para aprovar. */
export const REVIEW_CHECKLIST = [
  { key: "marca", label: "Logo oficial sem alteração (sem deformar, recolorir, contornar ou cortar) e com área de proteção." },
  { key: "identidade", label: "Cores, tipografia e composição conforme o AUDDOC003 (PRO azul, HUB verde, sem trocas)." },
  { key: "texto", label: "Texto revisado: ortografia, clareza e informação técnica correta." },
  { key: "tom", label: "Tom de voz: sem prometer “zero multas”, “certificação garantida” ou serviço fora das habilitações." },
  { key: "dados", label: "Somente dados reais e autorizados (contatos oficiais, sem dados pessoais ou de clientes sem autorização)." },
] as const;
export type ChecklistKey = (typeof REVIEW_CHECKLIST)[number]["key"];

/** Expressões que o AUDDOC003 §11 manda evitar — o sistema avisa (a decisão final é do revisor). */
const RISKY = [
  { re: /zero\s+multas?/i, msg: "“zero multa(s)” — o AUDDOC003 manda não prometer." },
  { re: /certifica[çc][ãa]o\s+garantida|garant\w*\s+(a\s+)?certifica/i, msg: "“certificação garantida” — promessa proibida." },
  { re: /\bgarant(imos|ido|ida|ia)\b/i, msg: "“garantimos/garantia” — evite promessas de resultado." },
  { re: /\b100\s?%/i, msg: "“100%” — evite promessas absolutas." },
  { re: /acredita[çc][ãa]o|acreditad[oa]/i, msg: "“acreditação” — não sugerir acreditação ou certificação efetiva (AUDDOC003 §07)." },
  { re: /\bART\b|\blaudos?\b/i, msg: "ART/laudo — serviços fora do escopo atual (AUDDOC017 §2); confira as habilitações." },
];

export function textWarnings(...texts: (string | null | undefined)[]): string[] {
  const all = texts.filter(Boolean).join("\n");
  return RISKY.filter((r) => r.re.test(all)).map((r) => r.msg);
}

/** Excessos de texto para o modelo escolhido (o banco aceita até o limite geral; o modelo pede menos). */
export function lengthWarnings(template: Template, p: { title?: string | null; subtitle?: string | null; body?: string | null; cta?: string | null }): string[] {
  const l = TEMPLATES[template].limits;
  const out: string[] = [];
  const chk = (v: string | null | undefined, max: number, name: string) => {
    if ((v ?? "").length > max) out.push(`${name} com ${(v ?? "").length} caracteres; para ${TEMPLATES[template].label} use até ${max}.`);
  };
  chk(p.title, l.title, "Título");
  chk(p.subtitle, l.subtitle, "Subtítulo");
  chk(p.body, l.body, "Texto");
  chk(p.cta, l.cta, "Chamada");
  return out;
}
