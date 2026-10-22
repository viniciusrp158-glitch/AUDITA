/** Treinamentos EAD (T1) — rótulos, tipos de material e regras simples de arquivo. */

export const TRAINING_BUCKET = "audita-treinamentos";

export const VERSION_STATUS = {
  rascunho: { label: "Rascunho", cls: "bg-warn/10 text-warn" },
  publicada: { label: "Publicada", cls: "bg-ok/10 text-ok" },
  substituida: { label: "Substituída", cls: "bg-surface text-muted" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
} as const;
export type VersionStatus = keyof typeof VERSION_STATUS;

export type FileKind =
  | "ficha_tecnica"
  | "plano_pedagogico"
  | "orientacoes"
  | "gabarito_consolidado"
  | "apostila"
  | "avaliacao_pdf"
  | "roteiro"
  | "gabarito"
  | "slides_pdf"
  | "slide_imagem";

type KindInfo = { label: string; audience: "aluno" | "equipe"; scope: "curso" | "modulo"; multiple?: boolean; accept: string[]; hint: string };

/** Mesmos tipos e públicos do banco (training_files.kind / audience). */
export const FILE_KINDS: Record<FileKind, KindInfo> = {
  ficha_tecnica: { label: "Ficha técnica", audience: "aluno", scope: "curso", accept: ["pdf"], hint: "Entregue ao aluno no Módulo 01." },
  plano_pedagogico: { label: "Plano pedagógico", audience: "equipe", scope: "curso", accept: ["pdf"], hint: "Só equipe." },
  orientacoes: { label: "Orientações do pacote (LEIA PRIMEIRO)", audience: "equipe", scope: "curso", accept: ["pdf"], hint: "Só equipe." },
  gabarito_consolidado: { label: "Gabarito consolidado", audience: "equipe", scope: "curso", accept: ["pdf"], hint: "Só equipe. Nunca publicar ao aluno." },
  apostila: { label: "Apostila / e-book", audience: "aluno", scope: "modulo", accept: ["pdf"], hint: "Material de leitura do aluno." },
  avaliacao_pdf: { label: "Avaliação (PDF de origem)", audience: "equipe", scope: "modulo", accept: ["pdf"], hint: "Fonte das questões; o aluno faz a prova no sistema." },
  roteiro: { label: "Roteiro de gravação", audience: "equipe", scope: "modulo", accept: ["pdf", "docx"], hint: "Só equipe." },
  gabarito: { label: "Gabarito comentado", audience: "equipe", scope: "modulo", accept: ["pdf", "docx"], hint: "Só equipe." },
  slides_pdf: { label: "Slides (PDF)", audience: "equipe", scope: "modulo", accept: ["pdf", "pptx"], hint: "Só equipe." },
  slide_imagem: { label: "Slides em imagem (PNG)", audience: "equipe", scope: "modulo", multiple: true, accept: ["png", "jpg", "jpeg"], hint: "Vários arquivos; a ordem segue o nome." },
};

export const COURSE_KINDS: FileKind[] = ["ficha_tecnica", "plano_pedagogico", "orientacoes", "gabarito_consolidado"];
export const MODULE_STAFF_KINDS: FileKind[] = ["roteiro", "gabarito", "avaliacao_pdf"];
export const MODULE_SLIDE_KINDS: FileKind[] = ["slides_pdf", "slide_imagem"];

export const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function acceptFor(kind: FileKind): string {
  return FILE_KINDS[kind].accept.map((e) => `.${e}`).join(",");
}

export function isFileKind(v: string): v is FileKind {
  return Object.prototype.hasOwnProperty.call(FILE_KINDS, v);
}

/** Código do módulo no padrão do material (M01, M02…). */
export function moduleCode(position: number): string {
  return `M${String(position).padStart(2, "0")}`;
}

/** 240 → "4 h"; 98 → "1 h 38 min"; 20 → "20 min". */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const ENROLLMENT_STATUS = {
  ativa: { label: "Ativa", cls: "bg-ok/10 text-ok" },
  suspensa: { label: "Suspensa", cls: "bg-warn/10 text-warn" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted line-through" },
  concluida: { label: "Concluída", cls: "bg-blue/10 text-blue" },
} as const;

export const ENROLLMENT_SOURCE = { gestao: "Individual", lote: "Em lote", compra: "Compra", cortesia: "Cortesia" } as const;

/** Linha de aluno para matrícula em lote. */
export type StudentInput = { nome: string; email: string; cpf?: string; empresa?: string; telefone?: string };

/**
 * Lê a planilha de alunos (CSV exportado do Excel/Google Planilhas, ou texto colado). Aceita ";", "," ou tabulação,
 * com ou sem cabeçalho. Colunas reconhecidas pelo cabeçalho: nome, e-mail, CPF, empresa, telefone; sem cabeçalho,
 * a ordem é nome, e-mail, CPF, empresa, telefone.
 */
export function parseStudentSheet(text: string): { rows: StudentInput[]; ignored: number } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], ignored: 0 };
  const sep = [";", "\t", ","].find((s) => lines[0].includes(s)) ?? ";";
  const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z]/g, "");
  const first = split(lines[0]).map(norm);
  const hasHeader = first.some((c) => ["nome", "email", "cpf", "empresa", "telefone"].includes(c));
  const idx = (names: string[], fallback: number) => {
    if (!hasHeader) return fallback;
    const i = first.findIndex((c) => names.includes(c));
    return i;
  };
  const col = {
    nome: idx(["nome", "nomecompleto", "aluno"], 0),
    email: idx(["email", "emaildoaluno"], 1),
    cpf: idx(["cpf"], 2),
    empresa: idx(["empresa"], 3),
    telefone: idx(["telefone", "celular", "whatsapp"], 4),
  };
  const rows: StudentInput[] = [];
  let ignored = 0;
  for (const l of hasHeader ? lines.slice(1) : lines) {
    const c = split(l);
    const get = (i: number) => (i >= 0 ? (c[i] ?? "").trim() : "");
    const r: StudentInput = { nome: get(col.nome), email: get(col.email).toLowerCase() };
    if (get(col.cpf)) r.cpf = get(col.cpf);
    if (get(col.empresa)) r.empresa = get(col.empresa);
    if (get(col.telefone)) r.telefone = get(col.telefone);
    if (!r.nome && !r.email) {
      ignored++;
      continue;
    }
    rows.push(r);
  }
  return { rows, ignored };
}

/** Aceita links do YouTube (vídeo não listado) nos formatos usuais. */
export const YOUTUBE_RE = /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}([?&#][A-Za-z0-9_=&.-]*)?$/;
