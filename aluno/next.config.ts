import type { NextConfig } from "next";

/**
 * Área do aluno dos treinamentos — audita.seg.br/treinamentos (decisão do Diretor, 22/10/2026).
 * Site separado do sistema da equipe (/empresa): mesmo banco, sessão própria (cookie "audita-aluno", só em /treinamentos)
 * e nenhuma tela da equipe. Compila a partir da raiz do repositório: `npx next build aluno`.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  basePath: "/treinamentos",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
