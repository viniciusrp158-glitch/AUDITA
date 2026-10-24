import type { MetadataRoute } from "next";
import { FAMILIAS } from "@/content/servicos";

export const dynamic = "force-static";

/** sitemap.xml (briefing 10.6). Os buscadores só o leem depois da publicação: até lá o robots.txt bloqueia o site. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://audita.seg.br";
  const paginas = ["/", "/a-audita/", "/solucoes/", ...FAMILIAS.map((f) => `/solucoes/${f.slug}/`), "/audita-pro/", "/audita-hub/", "/cursos/", "/contato/", "/privacidade/"];
  return paginas.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.7 }));
}
