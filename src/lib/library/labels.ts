/** Biblioteca documental — rótulos e regras simples (AUDDOC017 RF-19 a RF-22). */

export const PHASES = {
  fase1: { label: "Fase 1 — Planejamento" },
  fase2: { label: "Fase 2 — Estruturação operacional e comercial" },
  fase3: { label: "Fase 3 — Sistemas" },
} as const;
export type Phase = keyof typeof PHASES;

export const LIB_REV_STATUS = {
  rascunho: { label: "Rascunho", cls: "bg-warn/10 text-warn" },
  vigente: { label: "Vigente", cls: "bg-ok/10 text-ok" },
  substituido: { label: "Substituída", cls: "bg-surface text-muted" },
  cancelado: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
} as const;
export type LibRevStatus = keyof typeof LIB_REV_STATUS;

/** Tipos de arquivo aceitos no bucket privado (iguais aos do banco). */
export const MIME_BY_EXT: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};
export const ACCEPT = Object.keys(MIME_BY_EXT).map((e) => `.${e}`).join(",");
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** Nome de arquivo seguro para o armazenamento (sem acentos/espaços), preservando a extensão. */
export function safeFileName(name: string): string {
  const ext = extOf(name);
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
  return `${base || "arquivo"}.${ext}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export const LIBRARY_BUCKET = "audita-biblioteca";
