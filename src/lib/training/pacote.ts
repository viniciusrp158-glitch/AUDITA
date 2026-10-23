/**
 * Importador do pacote .zip de um treinamento (padrão do L01):
 *   00_Orientacoes/L01_LEIA_PRIMEIRO.pdf · 01_Ficha_e_Plano/L01_Ficha_Tecnica.pdf, L01_Plano_Pedagogico.pdf
 *   02_Aluno/Mnn_…/L01_Mnn_Apostila.pdf, L01_Mnn_Avaliacao.pdf
 *   03_Instrutor/L01_Gabarito_Consolidado.pdf · 03_Instrutor/Mnn_…/L01_Mnn_Roteiro.pdf, L01_Mnn_Gabarito.pdf
 *   04_Slides/Mnn_…/L01_Mnn_Slides.pdf e …/PNG_4K/L01_Mnn_Slide_NN.png
 * Funções puras (rodam no navegador e nos testes): classificação dos arquivos e leitura da ficha técnica.
 */
import type { FileKind } from "./labels";

export type PackageEntry = { path: string; size: number };
export type PackageFile = PackageEntry & { name: string; kind: FileKind; module: number | null };
export type PackagePlan = {
  code: string | null;
  files: PackageFile[];
  ignored: { path: string; reason: string }[];
  modules: number[];
  warnings: string[];
};

const MAX_BYTES = 50 * 1024 * 1024;
const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)|(^|\/)\._/i;

const ext = (n: string) => n.slice(n.lastIndexOf(".") + 1).toLowerCase();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tipo do material pelo nome do arquivo (e pela pasta, nas imagens dos slides e nas orientações). */
function kindOf(path: string, name: string, module: number | null): FileKind | null {
  const n = norm(name);
  const p = norm(path);
  const e = ext(name);
  if (["png", "jpg", "jpeg"].includes(e)) return module && (p.includes("slide") || n.includes("slide")) ? "slide_imagem" : null;
  if (e !== "pdf") return null;
  if (n.includes("consolidado")) return "gabarito_consolidado";
  if (n.includes("ficha")) return "ficha_tecnica";
  if (n.includes("plano")) return "plano_pedagogico";
  if (n.includes("leia_primeiro") || n.includes("orientac") || /(^|\/)00[_ -]/.test(p)) return module ? null : "orientacoes";
  if (!module) return null;
  if (n.includes("apostila")) return "apostila";
  if (n.includes("gabarito")) return "gabarito";
  if (n.includes("roteiro")) return "roteiro";
  if (n.includes("avaliac")) return "avaliacao_pdf";
  if (n.includes("slide")) return "slides_pdf";
  return null;
}

/** Número do módulo pelo nome (L01_M03_…) ou pela pasta (M03_Perigos_e_Riscos). */
function moduleOf(path: string): number | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const byName = /(?:^|_)M(\d{2})(?:_|\.|$)/i.exec(name);
  if (byName) return Number(byName[1]);
  for (const seg of path.split("/").slice(0, -1).reverse()) {
    const m = /^M(\d{2})(?:[_ -]|$)/i.exec(seg);
    if (m) return Number(m[1]);
  }
  return null;
}

export function classifyPackage(entries: PackageEntry[]): PackagePlan {
  const files: PackageFile[] = [];
  const ignored: PackagePlan["ignored"] = [];
  const codes = new Map<string, number>();
  for (const e of entries) {
    if (e.path.endsWith("/")) continue;
    if (JUNK.test(e.path)) continue;
    const name = e.path.slice(e.path.lastIndexOf("/") + 1);
    const mod = moduleOf(e.path);
    const kind = kindOf(e.path, name, mod);
    if (!kind) {
      ignored.push({ path: e.path, reason: "Arquivo fora do padrão do pacote" });
      continue;
    }
    if (e.size > MAX_BYTES) {
      ignored.push({ path: e.path, reason: "Maior que 50 MB" });
      continue;
    }
    const c = /^([A-Z]{1,4}\d{2,3})_/.exec(name);
    if (c) codes.set(c[1], (codes.get(c[1]) ?? 0) + 1);
    const scoped = !["ficha_tecnica", "plano_pedagogico", "orientacoes", "gabarito_consolidado"].includes(kind);
    files.push({ ...e, name, kind, module: scoped ? mod : null });
  }

  // Um arquivo por tipo (exceto as imagens dos slides): os repetidos ficam de fora
  const seen = new Set<string>();
  const unique: PackageFile[] = [];
  // Entre repetidos, fica o de nome padrão (o mais curto: L01_M02_Slides.pdf antes de L01_M02_Slides_copia.pdf)
  for (const f of files.sort((a, b) => a.name.length - b.name.length || a.path.localeCompare(b.path))) {
    const key = f.kind === "slide_imagem" ? f.path : `${f.kind}:${f.module ?? ""}`;
    if (seen.has(key)) {
      ignored.push({ path: f.path, reason: "Já há um arquivo deste tipo neste módulo" });
      continue;
    }
    seen.add(key);
    unique.push(f);
  }

  const modules = [...new Set(unique.filter((f) => f.module).map((f) => f.module!))].sort((a, b) => a - b);
  const code = [...codes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const warnings: string[] = [];
  const has = (k: FileKind, m: number | null = null) => unique.some((f) => f.kind === k && f.module === m);
  const mc = (m: number) => `M${String(m).padStart(2, "0")}`;
  if (!code) warnings.push("Código do treinamento não encontrado nos nomes dos arquivos (ex.: L01_M01_Apostila.pdf).");
  if (!has("ficha_tecnica")) warnings.push("Ficha técnica não encontrada: a ficha do curso fica em branco.");
  if (!modules.includes(1)) warnings.push("Módulo 01 (Ambientação) não encontrado.");
  modules.forEach((m, i) => {
    if (i > 0 && m !== modules[i - 1] + 1) warnings.push(`Falta o módulo entre ${mc(modules[i - 1])} e ${mc(m)}.`);
    if (!has("apostila", m)) warnings.push(`${mc(m)}: sem apostila (obrigatória para publicar).`);
    if (!has("gabarito", m)) warnings.push(`${mc(m)}: sem gabarito comentado (o módulo fica sem questões).`);
  });
  return { code, files: unique, ignored, modules, warnings };
}

// ---------------------------------------------------------------------------
// Ficha técnica (texto do pdftotext: normal e com -layout para a tabela de minutos)
// ---------------------------------------------------------------------------
export type FichaModule = { position: number; title: string; objective: string | null; content_summary: string | null; video_minutes: number | null; reading_minutes: number | null; activity_minutes: number | null };
export type FichaData = {
  title: string | null;
  version: string | null;
  workload_minutes: number | null;
  instructor_name: string | null;
  modality: string | null;
  audience: string | null;
  prerequisites: string | null;
  general_objective: string | null;
  methodology: string | null;
  assessment_rules: string | null;
  important_notice: string | null;
  resources: string | null;
  references_text: string | null;
  modules: FichaModule[];
};

const flat = (s: string | undefined | null) => (s ? s.replace(/\s+/g, " ").trim() || null : null);
const FOOTER = /^AUDITA \| SSMA & SGI\b.*$/gm;
const HEADER = /^L\d{2,3}\s*•\s*(Material do aluno|Uso exclusivo da equipe)\b.*$/gm;

function between(text: string, start: RegExp, end: RegExp): string | null {
  const s = start.exec(text);
  if (!s) return null;
  const rest = text.slice(s.index + s[0].length);
  const e = end.exec(rest);
  return flat(e ? rest.slice(0, e.index) : rest);
}

export function parseFicha(text: string, layout: string): FichaData {
  const clean = text.replace(/\f/g, "\n").replace(FOOTER, "").replace(HEADER, (h) => h);
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const version = /\bv(\d{1,2}\.\d{1,2})\b/.exec(clean)?.[1] ?? null;
  const ti = lines.findIndex((l) => /^Ficha técnica/i.test(l));
  const title = ti >= 0 && lines[ti + 1] ? flat(lines[ti + 1].split(/\s+•\s+AUDITA\b/)[0]) : null;
  const workload = /\((\d{2,5}) minutos\)/.exec(clean);

  // Bloco "Descrição": título, "<código> <instituição>", instrutor, modalidade, carga, público, pré-requisitos
  let instructor: string | null = null;
  let modality: string | null = null;
  let audience: string | null = null;
  let prerequisites: string | null = null;
  const di = lines.findIndex((l) => /^Descrição\b/.test(l));
  if (di >= 0 && /^[A-Z]{1,4}\d{2,3}\s/.test(lines[di + 1] ?? "") && /minutos/.test(lines[di + 4] ?? "")) {
    instructor = flat(lines[di + 2]);
    modality = flat(lines[di + 3]);
    audience = flat(lines[di + 5]);
    prerequisites = flat(lines[di + 6]);
  }

  const body = clean.replace(HEADER, "");
  const minutes = new Map<number, [number, number, number]>();
  for (const m of layout.matchAll(/^\s*(\d{2})\s*•.*?(\d+)\s*min\s+(\d+)\s*min\s+(\d+)\s*min\s+(\d+)\s*min/gm)) {
    minutes.set(Number(m[1]), [Number(m[2]), Number(m[3]), Number(m[4])]);
  }
  const modules: FichaModule[] = [];
  for (const m of body.matchAll(/Módulo (\d{2}) • ([^\n]+)\n([\s\S]*?)(?=\nMódulo \d{2} • |\nMetodologia\b|$)/g)) {
    const block = m[3];
    const mins = minutes.get(Number(m[1]));
    modules.push({
      position: Number(m[1]),
      title: flat(m[2])!,
      objective: between(block, /Objetivo:\s*/, /Conteúdo:/),
      content_summary: between(block, /Conteúdo:\s*/, /$^/),
      video_minutes: mins?.[0] ?? null,
      reading_minutes: mins?.[1] ?? null,
      activity_minutes: mins?.[2] ?? null,
    });
  }
  const rawNotice = between(body, /\nImportante:\s*/, /\nRecursos e apoio\b/);
  const notice = rawNotice ? rawNotice.charAt(0).toUpperCase() + rawNotice.slice(1) : null;
  return {
    title,
    version,
    workload_minutes: workload ? Number(workload[1]) : null,
    instructor_name: instructor,
    modality,
    audience,
    prerequisites,
    general_objective: between(body, /\nObjetivo geral\s*\n/, /\nConteúdo programático/),
    methodology: between(body, /\nMetodologia\s*\n/, /\nAvaliação e certificação\b/),
    assessment_rules: between(body, /\nAvaliação e certificação\s*\n/, /\nImportante:|\nRecursos e apoio\b/),
    important_notice: notice,
    resources: between(body, /\nRecursos e apoio\s*\n/, /\nReferências\b/),
    references_text: between(body, /\nReferências\s*\n/, /$^/),
    modules,
  };
}

/** Título do módulo pelo nome da pasta, quando não houver ficha (M03_Perigos_e_Riscos → "Perigos e Riscos"). */
export function titleFromFolder(path: string, module: number): string | null {
  const seg = path.split("/").find((s) => new RegExp(`^M${String(module).padStart(2, "0")}[_ -]`, "i").test(s));
  return seg ? flat(seg.replace(/^M\d{2}[_ -]/i, "").replace(/[_-]+/g, " ")) : null;
}
