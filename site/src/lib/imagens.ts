/**
 * Imagens definitivas colocadas em site/public/images/site (lista montada no build pelo next.config.ts).
 * O código é o do briefing: "IMG-02", "IMG-08 (fundo)", "Capa L01"…
 */
const IMAGENS: Record<string, string> = JSON.parse(process.env.NEXT_PUBLIC_IMAGENS_SITE ?? "{}");
const VIDEOS: Record<string, string> = JSON.parse(process.env.NEXT_PUBLIC_VIDEOS_SITE ?? "{}");

function chave(codigo: string): string {
  return codigo.toLowerCase().replace(/\(fundo\)/, "").trim().replace(/\s+/g, "-");
}

export function imagemDefinitiva(codigo: string): string | undefined {
  return IMAGENS[chave(codigo)];
}

export function videoDefinitivo(codigo: string): string | undefined {
  return VIDEOS[chave(codigo)];
}
