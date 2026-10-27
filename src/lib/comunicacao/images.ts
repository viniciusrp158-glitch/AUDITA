/**
 * C1 — Imagens enviadas com o pedido à IA (referência de estilo ou foto de fundo) e montagem da área da arte.
 * Tudo no servidor: as imagens são reduzidas (até 1600 px no lado maior), sem metadados, antes de ir ao banco e à IA.
 */
import "server-only";
import sharp from "sharp";

export const MAX_REFERENCES = 3;
export const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
export const REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type NormalizedImage = { mime: "image/png" | "image/jpeg"; base64: string; width: number; height: number };

/** Gira conforme o EXIF, reduz e regrava (JPEG para fotos; PNG quando há transparência). Remove os metadados. */
export async function normalizeReference(buf: Buffer): Promise<NormalizedImage> {
  const img = sharp(buf, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  const resized = img.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
  const out = meta.hasAlpha
    ? await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await resized.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { mime: meta.hasAlpha ? "image/png" : "image/jpeg", base64: out.data.toString("base64"), width: out.info.width, height: out.info.height };
}

/** Área da arte: foto de fundo recortada para preencher (centro) e a arte da IA (transparente) por cima. */
export async function composeArtArea(artPng: Buffer, background: Buffer | null, width: number, height: number): Promise<Buffer> {
  if (!background) return artPng;
  const art = await sharp(artPng).resize(width, height, { fit: "fill" }).png().toBuffer();
  return sharp(background)
    .resize(width, height, { fit: "cover", position: "centre" })
    .composite([{ input: art }])
    .png()
    .toBuffer();
}
