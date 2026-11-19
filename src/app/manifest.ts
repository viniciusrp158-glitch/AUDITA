import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";

/**
 * Aplicativo na tela inicial do celular (adaptação ao celular, pedido do Diretor em 17/11/2026): abre em tela cheia,
 * com o ícone da AUDITA, direto no sistema. Não guarda dados no aparelho além dos que o navegador já guarda.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AUDITA — Sistema de Operação",
    short_name: "AUDITA",
    description: "AUDITA | SSMA & SGI — sistema administrativo interno",
    id: withBase("/"),
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#031b35",
    lang: "pt-BR",
    icons: [
      { src: withBase("/brand/app-icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/brand/app-icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/brand/app-icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
