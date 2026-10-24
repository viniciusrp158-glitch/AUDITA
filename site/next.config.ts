import type { NextConfig } from "next";

/**
 * Site institucional da AUDITA — raiz de audita.seg.br (briefing v1.0 de 23/10/2026).
 * Páginas estáticas (output "export"), servidas pelo container audita-site; /empresa, /treinamentos e
 * /pagamentos continuam nos seus containers. Compila a partir da raiz do repositório: `npx next build site`.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Cada página vira <rota>/index.html, servida pelo Nginx sem regra especial
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
