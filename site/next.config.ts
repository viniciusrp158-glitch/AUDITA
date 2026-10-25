import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * Site institucional da AUDITA — raiz de audita.seg.br (briefing v1.0 de 23/10/2026).
 * Páginas estáticas (output "export"), servidas pelo container audita-site; /empresa, /treinamentos e
 * /pagamentos continuam nos seus containers. Compila a partir da raiz do repositório: `npx next build site`.
 */

/**
 * Imagens definitivas: um arquivo em site/public/images/site cujo nome começa pelo código do briefing
 * (img-01-hero.jpg, img-01m-hero.jpg, img-02.webp, capa-l01.webp…) entra sozinho no lugar do espaço marcado no
 * próximo build. Vídeo do hero: img-01.mp4 (com img-01.* como pôster). Preferência: avif, webp, jpg, png.
 */
function imagensDefinitivas() {
  const pasta = join(__dirname, "public", "images", "site");
  const imagens: Record<string, string> = {};
  const videos: Record<string, string> = {};
  if (!existsSync(pasta)) return { imagens, videos };
  const ordem = [".avif", ".webp", ".jpg", ".jpeg", ".png"];
  for (const arquivo of readdirSync(pasta).sort()) {
    const m = /^(img-\d{2}m?|capa-l\d{2})\b.*?(\.[a-z0-9]+)$/i.exec(arquivo);
    if (!m) continue;
    const chave = m[1].toLowerCase();
    const ext = m[2].toLowerCase();
    if (ext === ".mp4") videos[chave] = `/images/site/${arquivo}`;
    else if (ordem.includes(ext)) {
      const atual = imagens[chave];
      if (!atual || ordem.indexOf(ext) < ordem.indexOf(atual.slice(atual.lastIndexOf(".")).toLowerCase())) imagens[chave] = `/images/site/${arquivo}`;
    }
  }
  return { imagens, videos };
}

const definitivas = imagensDefinitivas();

const nextConfig: NextConfig = {
  output: "export",
  // Cada página vira <rota>/index.html, servida pelo Nginx sem regra especial
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_IMAGENS_SITE: JSON.stringify(definitivas.imagens),
    NEXT_PUBLIC_VIDEOS_SITE: JSON.stringify(definitivas.videos),
  },
};

export default nextConfig;
