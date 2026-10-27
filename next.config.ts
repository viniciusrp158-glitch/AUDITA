import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Imagem enxuta na VPS: o build gera um servidor só com os arquivos usados (sem o node_modules inteiro)
  output: "standalone",
  // Sistema em audita.seg.br/empresa (caderno I2.01); a raiz e caminhos antigos levam ao sistema
  basePath: BASE_PATH,
  async redirects() {
    return [
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      { source: "/:path((?!empresa(?:/|$)).*)", destination: `${BASE_PATH}/:path`, basePath: false, permanent: false },
    ];
  },
  // Geração de PDF no servidor (pdfmake/pdfkit) e da arte da IA (resvg, binário nativo) carregados do node_modules, sem empacotamento
  serverExternalPackages: ["pdfmake", "@resvg/resvg-js", "sharp"],
  // Importador de treinamentos: o PDF da ficha e dos gabaritos vai para a conferência (até 8 MB por envio)
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
