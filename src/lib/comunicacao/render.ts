/**
 * I10 — Renderização das peças (PNG e PDF) com a identidade do AUDDOC003. Um único desenho serve à prévia e à exportação.
 * - Fundo branco preferencial; textos em azul-marinho; acento da marca (verde AUDITA, azul PRO ou verde HUB) em linhas finas.
 * - Logo: o arquivo oficial aprovado, sem alteração, sempre sobre área branca com respiro (área de proteção ≥ 0,5x).
 *   Sem logo aprovado, a prévia mostra "LOGO OFICIAL PENDENTE" (e a aprovação é bloqueada no banco).
 * - Contatos: somente os oficiais publicados nos dados institucionais (I9.2); nada inventado.
 * - Fora da produção, ou com dados de teste, a peça leva a faixa "TESTE — SEM VALIDADE".
 */
import "server-only";
import { createElement as h, type CSSProperties, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { formatPhone } from "@/lib/br";
import { ensurePdfmake } from "@/lib/documents/render-pdf";
import { MONTSERRAT_BOLD, MONTSERRAT_REGULAR, MONTSERRAT_SEMIBOLD } from "./fonts";
import { BRANDS, PALETTE, SIGNATURE, SLOGAN, TEMPLATES, type Brand, type Template } from "./labels";

export type RenderLogo = { dataUri: string; width: number; height: number };
export type RenderContacts = { email: string | null; phone: string | null; website: string | null } | null;

export type PieceRenderInput = {
  template: Template;
  brand: Brand;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  cta: string | null;
  showSlogan: boolean;
  /** Exibir contatos? Se sim e não houver contatos oficiais publicados, mostra PENDENTE. */
  showContacts: boolean;
  contacts: RenderContacts;
  logo: RenderLogo | null;
  watermark: boolean;
};

const b64 = (s: string) => {
  const buf = Buffer.from(s, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};
let fontCache: { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" }[] | null = null;
function fonts() {
  fontCache ??= [
    { name: "Montserrat", data: b64(MONTSERRAT_REGULAR), weight: 400, style: "normal" },
    { name: "Montserrat", data: b64(MONTSERRAT_SEMIBOLD), weight: 600, style: "normal" },
    { name: "Montserrat", data: b64(MONTSERRAT_BOLD), weight: 700, style: "normal" },
  ];
  return fontCache;
}

type Props = { style?: CSSProperties; children?: ReactNode };
const box = (style: CSSProperties, ...children: ReactNode[]) => h("div", { style: { display: "flex", ...style } } as Props, ...children);
const text = (style: CSSProperties, value: string) => h("div", { style: { display: "flex", ...style } } as Props, value);

/** Tamanho de fonte que diminui com o comprimento do texto (evita estouro sem cortar conteúdo). */
function fit(len: number, base: number, comfortable: number, min = 0.55): number {
  if (len <= comfortable) return base;
  return Math.max(Math.round(base * min), Math.round(base * Math.sqrt(comfortable / len)));
}

export function contactsLine(c: RenderContacts): string | null {
  if (!c) return null;
  const parts = [c.website, c.email, c.phone ? formatPhone(c.phone) : null].filter(Boolean);
  return parts.length ? parts.join("  ·  ") : null;
}

function logoBlock(logo: RenderLogo | null, height: number) {
  const pad = Math.round(height * 0.35); // área de proteção (≥ 0,5x da altura das minúsculas; aproximação conservadora)
  if (!logo)
    return box(
      {
        height: height + pad,
        width: Math.round(height * 3.2),
        border: `3px dashed ${PALETTE.gray}`,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        color: PALETTE.gray,
        fontSize: Math.round(height * 0.22),
        fontWeight: 600,
        letterSpacing: 1,
      },
      "LOGO OFICIAL PENDENTE",
    );
  const w = Math.round((height * logo.width) / logo.height);
  return box(
    { backgroundColor: PALETTE.white, padding: pad / 2, borderRadius: 8 },
    h("img", { src: logo.dataUri, width: w, height, style: { width: w, height } }),
  );
}

function watermarkBand(width: number) {
  return box(
    {
      position: "absolute",
      top: Math.round(width * 0.02),
      right: Math.round(width * 0.02),
      backgroundColor: "#FDE7E7",
      color: "#9B1C1C",
      border: "2px solid #E8A3A3",
      borderRadius: 999,
      padding: `${Math.round(width * 0.006)}px ${Math.round(width * 0.016)}px`,
      fontSize: Math.round(width * 0.016),
      fontWeight: 700,
      letterSpacing: 1,
    },
    "TESTE — SEM VALIDADE",
  );
}

function footer(p: PieceRenderInput, W: number, H: number, opts: { compact?: boolean } = {}) {
  const brand = BRANDS[p.brand];
  const contacts = p.showContacts ? (contactsLine(p.contacts) ?? "Contatos oficiais PENDENTES") : null;
  const fs = Math.round(Math.min(W, H) * (opts.compact ? 0.02 : 0.024));
  return box(
    {
      flexDirection: "column",
      backgroundColor: PALETTE.navy,
      color: PALETTE.white,
      padding: `${Math.round(fs * 1.1)}px ${Math.round(W * 0.06)}px`,
      gap: Math.round(fs * 0.4),
    },
    box(
      { justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" },
      text({ fontSize: fs, fontWeight: 700, letterSpacing: 0.5 }, brand.endorsement ?? SIGNATURE),
      p.showSlogan ? text({ fontSize: Math.round(fs * 0.9), fontWeight: 400, color: "#DCE3EA" }, SLOGAN) : null,
    ),
    contacts ? text({ fontSize: Math.round(fs * 0.85), color: "#DCE3EA" }, contacts) : null,
  );
}

function ctaPill(cta: string, fs: number, accent: string) {
  return box(
    { alignSelf: "flex-start", alignItems: "center", gap: 14, backgroundColor: PALETTE.navy, color: PALETTE.white, borderRadius: 999, padding: `${Math.round(fs * 0.55)}px ${Math.round(fs * 1.1)}px` },
    box({ width: Math.round(fs * 0.45), height: Math.round(fs * 0.45), borderRadius: 999, backgroundColor: accent }),
    text({ fontSize: fs, fontWeight: 600 }, cta),
  );
}

/** Peças de redes sociais (quadrado, retrato e story). */
function socialLayout(p: PieceRenderInput, W: number, H: number) {
  const accent = BRANDS[p.brand].accent;
  const pad = Math.round(W * 0.075);
  const title = (p.title ?? "").trim();
  const sub = (p.subtitle ?? "").trim();
  const body = (p.body ?? "").trim();
  const tall = H / W > 1.5;
  const titleFs = fit(title.length, Math.round(W * (tall ? 0.085 : 0.075)), tall ? 34 : 30);
  const subFs = fit(sub.length, Math.round(W * 0.04), 60, 0.7);
  const bodyFs = fit(body.length, Math.round(W * 0.031), tall ? 160 : 120, 0.7);
  return box(
    { width: W, height: H, flexDirection: "column", backgroundColor: PALETTE.white, fontFamily: "Montserrat", color: PALETTE.navy, position: "relative" },
    box({ height: Math.round(W * 0.012), backgroundColor: accent }),
    box(
      { flex: 1, flexDirection: "column", padding: `${Math.round(pad * 0.8)}px ${pad}px ${pad}px`, gap: Math.round(W * 0.03) },
      logoBlock(p.logo, Math.round(W * (tall ? 0.085 : 0.075))),
      box({ width: Math.round(W * 0.12), height: 6, borderRadius: 3, backgroundColor: accent, marginTop: Math.round(W * (tall ? 0.12 : 0.03)) }),
      text({ fontSize: titleFs, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.5 }, title || "Título da peça"),
      sub ? text({ fontSize: subFs, fontWeight: 600, lineHeight: 1.3, color: "#1F3550" }, sub) : null,
      body ? text({ fontSize: bodyFs, fontWeight: 400, lineHeight: 1.45, color: "#2A3B52", whiteSpace: "pre-wrap" }, body) : null,
      box({ flex: 1 }),
      p.cta?.trim() ? ctaPill(p.cta.trim(), Math.round(W * 0.034), accent) : null,
    ),
    footer(p, W, H),
    p.watermark ? watermarkBand(W) : null,
  );
}

/** Capa de apresentação 16:9 (AUDDOC003 §11: logo, título ligado a SSMA/SGI, slogan e destaque discreto de verde). */
function coverLayout(p: PieceRenderInput, W: number, H: number) {
  const accent = BRANDS[p.brand].accent;
  const title = (p.title ?? "").trim();
  const sub = (p.subtitle ?? "").trim();
  const body = (p.body ?? "").trim();
  const pad = Math.round(H * 0.09);
  return box(
    { width: W, height: H, backgroundColor: PALETTE.white, fontFamily: "Montserrat", color: PALETTE.navy, position: "relative" },
    box(
      { flexDirection: "column", width: Math.round(W * 0.66), padding: `${pad}px ${pad}px ${pad}px ${Math.round(pad * 1.2)}px`, gap: Math.round(H * 0.035) },
      logoBlock(p.logo, Math.round(H * 0.1)),
      box({ flex: 1 }),
      box({ width: Math.round(W * 0.07), height: 8, borderRadius: 4, backgroundColor: accent }),
      text({ fontSize: fit(title.length, Math.round(H * 0.085), 40), fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }, title || "Título da apresentação"),
      sub ? text({ fontSize: fit(sub.length, Math.round(H * 0.04), 80, 0.7), fontWeight: 600, lineHeight: 1.3, color: "#1F3550" }, sub) : null,
      body ? text({ fontSize: Math.round(H * 0.028), lineHeight: 1.45, color: "#2A3B52" }, body) : null,
      box({ flex: 1 }),
      p.cta?.trim() ? ctaPill(p.cta.trim(), Math.round(H * 0.03), accent) : null,
    ),
    box(
      {
        flex: 1,
        flexDirection: "column",
        justifyContent: "flex-end",
        backgroundColor: PALETTE.navy,
        color: PALETTE.white,
        padding: pad,
        gap: Math.round(H * 0.02),
        borderLeft: `${Math.round(W * 0.008)}px solid ${accent}`,
      },
      p.showSlogan ? text({ fontSize: Math.round(H * 0.04), fontWeight: 600, lineHeight: 1.3 }, SLOGAN) : null,
      text({ fontSize: Math.round(H * 0.026), fontWeight: 700, color: "#DCE3EA" }, BRANDS[p.brand].endorsement ?? SIGNATURE),
      p.showContacts ? text({ fontSize: Math.round(H * 0.022), color: "#DCE3EA", lineHeight: 1.5 }, (contactsLine(p.contacts) ?? "Contatos oficiais PENDENTES").replace(/ {2}· {2}/g, "\n")) : null,
    ),
    p.watermark ? watermarkBand(W) : null,
  );
}

/** Comunicado A4. */
function noticeLayout(p: PieceRenderInput, W: number, H: number) {
  const accent = BRANDS[p.brand].accent;
  const pad = Math.round(W * 0.08);
  const body = (p.body ?? "").trim();
  return box(
    { width: W, height: H, flexDirection: "column", backgroundColor: PALETTE.white, fontFamily: "Montserrat", color: PALETTE.navy, position: "relative" },
    box(
      { justifyContent: "space-between", alignItems: "center", padding: `${Math.round(pad * 0.7)}px ${pad}px ${Math.round(pad * 0.4)}px` },
      logoBlock(p.logo, Math.round(W * 0.06)),
      text({ fontSize: Math.round(W * 0.022), fontWeight: 700, letterSpacing: 3, color: PALETTE.gray }, "COMUNICADO"),
    ),
    box({ height: 4, marginLeft: pad, marginRight: pad, backgroundColor: accent }),
    box(
      { flex: 1, flexDirection: "column", padding: `${Math.round(pad * 0.7)}px ${pad}px`, gap: Math.round(W * 0.025) },
      text({ fontSize: fit((p.title ?? "").length, Math.round(W * 0.05), 45), fontWeight: 700, lineHeight: 1.15 }, (p.title ?? "").trim() || "Título do comunicado"),
      p.subtitle?.trim() ? text({ fontSize: Math.round(W * 0.026), fontWeight: 600, lineHeight: 1.35, color: "#1F3550" }, p.subtitle.trim()) : null,
      body ? text({ fontSize: fit(body.length, Math.round(W * 0.021), 450, 0.8), lineHeight: 1.6, color: "#1E2C3F", whiteSpace: "pre-wrap" }, body) : null,
      box({ flex: 1 }),
      p.cta?.trim() ? ctaPill(p.cta.trim(), Math.round(W * 0.022), accent) : null,
    ),
    footer(p, W, H, { compact: true }),
    p.watermark ? watermarkBand(W) : null,
  );
}

export async function renderPiecePng(p: PieceRenderInput): Promise<Buffer> {
  const t = TEMPLATES[p.template];
  const el =
    p.template === "capa_apresentacao" ? coverLayout(p, t.width, t.height) : p.template === "comunicado_a4" ? noticeLayout(p, t.width, t.height) : socialLayout(p, t.width, t.height);
  const res = new ImageResponse(el, { width: t.width, height: t.height, fonts: fonts() });
  return Buffer.from(await res.arrayBuffer());
}

// PDF: a mesma imagem numa página do tamanho do modelo (A4 para o comunicado); metadados com código e versão.
export async function renderPiecePdf(png: Buffer, template: Template, meta: { title: string; subject: string }): Promise<Buffer> {
  const t = TEMPLATES[template];
  const page = template === "comunicado_a4" ? { width: 595.28, height: 841.89 } : { width: t.width * 0.5, height: t.height * 0.5 };
  ensurePdfmake();
  const def: TDocumentDefinitions = {
    pageSize: page,
    pageMargins: [0, 0, 0, 0],
    defaultStyle: { font: "Arial" },
    info: { title: meta.title, subject: meta.subject, author: "AUDITA", creator: "Sistema AUDITA de Operação" },
    content: [{ image: `data:image/png;base64,${png.toString("base64")}`, width: page.width, height: page.height }],
  };
  const doc = pdfmake.createPdf(def);
  return Buffer.from((await doc.getBuffer()) as Buffer);
}

export { pngSize } from "./png";
