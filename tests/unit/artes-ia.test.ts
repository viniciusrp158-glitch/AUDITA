import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sanitizeSvg, svgTexts } from "@/lib/comunicacao/ai";
import { artArea } from "@/lib/comunicacao/art-layout";
import { normalizeReference } from "@/lib/comunicacao/images";
import { TEMPLATE_KEYS } from "@/lib/comunicacao/labels";
import { pngSize, renderPiecePng } from "@/lib/comunicacao/render";

// Arte de exemplo no formato que a IA devolve (área do post quadrado), com texto em Montserrat
const area = artArea("post_quadrado");
const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="${area.width}" height="${area.height}" viewBox="0 0 ${area.width} ${area.height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3F4F6"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>
  <rect width="${area.width}" height="${area.height}" fill="url(#g)"/>
  <rect x="64" y="64" width="120" height="10" rx="5" fill="#80BB08"/>
  <text x="64" y="160" font-family="Montserrat" font-weight="700" font-size="64" fill="#031B35"><tspan x="64" dy="0">Treinamento</tspan><tspan x="64" dy="76">NR-35 · Trabalho</tspan><tspan x="64" dy="76">em altura</tspan></text>
  <text x="64" y="420" font-family="Montserrat" font-weight="400" font-size="30" fill="#1F3550">Capacitação presencial, com prática e simulado.</text>
  <g transform="translate(720 360)"><circle r="150" fill="#031B35"/><path d="M-60 40 L0 -80 L60 40 Z" fill="#80BB08"/><rect x="-8" y="40" width="16" height="70" fill="#FFFFFF"/></g>
  <rect x="64" y="560" width="360" height="72" rx="36" fill="#031B35"/>
  <text x="104" y="606" font-family="Montserrat" font-weight="600" font-size="28" fill="#FFFFFF">Solicite uma proposta</text>
</svg>`;

describe("C1 — artes com IA", () => {
  it("limpa conteúdo ativo e referências externas do SVG", () => {
    const dirty = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>alert(1)</script><image href="https://exemplo.test/a.png"/><a href="https://exemplo.test"><rect fill="url(#g)" style="background:url(https://x.test/a)"/></a><foreignObject><div/></foreignObject></svg>`;
    const s = sanitizeSvg(dirty);
    expect(s.startsWith("<svg")).toBe(true);
    expect(s).not.toMatch(/script|onload|<image|foreignObject|https:/i);
    expect(s).toContain('fill="url(#g)"'); // gradientes internos continuam
    expect(() => sanitizeSvg("<html>não é svg</html>")).toThrow();
  });

  it("extrai os textos da arte para os avisos de tom de voz", () => {
    expect(svgTexts(SAMPLE)).toContain("Solicite uma proposta");
  });

  it("a área da IA deixa a faixa do logo e o rodapé de fora em todos os modelos", () => {
    for (const t of TEMPLATE_KEYS) {
      const a = artArea(t);
      expect(a.width).toBeGreaterThan(0);
      expect(a.height).toBeGreaterThan(300);
    }
  });

  it("monta a peça final: logo + arte da IA + rodapé oficial, no tamanho do modelo", async () => {
    const png = await renderPiecePng({
      template: "post_quadrado",
      brand: "audita",
      title: "Treinamento NR-35",
      subtitle: null,
      body: null,
      cta: "Solicite uma proposta",
      showSlogan: true,
      showContacts: true,
      contacts: { email: "contato@exemplo.test", phone: null, website: "exemplo.test" },
      logo: null,
      watermark: true,
      artSvg: SAMPLE,
    });
    expect(pngSize(png)).toEqual({ width: 1080, height: 1080 });
    if (process.env.SALVAR_PREVIA) writeFileSync(process.env.SALVAR_PREVIA, png);
  });

  it("foto de fundo: reduz a imagem enviada e monta a arte transparente por cima", async () => {
    // "Foto" fictícia de 2400 × 1350 (paisagem), gerada no teste
    const photo = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: { r: 120, g: 170, b: 220 } } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1350"><circle cx="1600" cy="700" r="380" fill="#E8B23A"/><rect y="1000" width="2400" height="350" fill="#3B4A5C"/></svg>`) }])
      .jpeg()
      .toBuffer();
    const norm = await normalizeReference(photo);
    expect(norm.mime).toBe("image/jpeg");
    expect(Math.max(norm.width, norm.height)).toBe(1600);
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${area.width}" height="${area.height}">
      <path d="M0 0 H520 L300 330 H0 Z" fill="#031B35" fill-opacity="0.92"/>
      <path d="M520 0 L300 330" stroke="#80BB08" stroke-width="6"/>
      <rect x="48" y="${area.height - 250}" width="640" height="200" rx="16" fill="#031B35" fill-opacity="0.9"/>
      <text x="80" y="${area.height - 170}" font-family="Montserrat" font-weight="700" font-size="52" fill="#FFFFFF">NR-35 com segurança</text>
      <text x="80" y="${area.height - 110}" font-family="Montserrat" font-weight="600" font-size="28" fill="#80BB08">Treinamento presencial in company</text>
    </svg>`;
    const png = await renderPiecePng({
      template: "post_quadrado",
      brand: "audita",
      title: "NR-35 com segurança",
      subtitle: null,
      body: null,
      cta: null,
      showSlogan: true,
      showContacts: false,
      contacts: null,
      logo: null,
      watermark: true,
      artSvg: overlay,
      artBackground: Buffer.from(norm.base64, "base64"),
    });
    expect(pngSize(png)).toEqual({ width: 1080, height: 1080 });
    if (process.env.SALVAR_PREVIA) writeFileSync(process.env.SALVAR_PREVIA.replace(".png", "-foto.png"), png);
  });
});
