import type { MetadataRoute } from "next";
import { FAMILIAS } from "@/content/servicos";

export const dynamic = "force-static";

/** sitemap.xml (briefing 10.6; SEO 24/11/2026: data da publicação e páginas públicas da Audita Academy). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://audita.seg.br";
  const paginas = ["/", "/a-audita/", "/solucoes/", ...FAMILIAS.map((f) => `/solucoes/${f.slug}/`), "/audita-pro/", "/audita-hub/", "/contato/", "/privacidade/"];
  const atualizado = new Date();
  const academy = ["/treinamentos/", "/treinamentos/cursos"];
  return [...paginas, ...academy].map((p) => ({ url: `${base}${p}`, lastModified: atualizado, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.7 }));
}
