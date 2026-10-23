"use client";

import JSZip from "jszip";
import Link from "next/link";
import { CheckCircle2, FileArchive, TriangleAlert } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Alert } from "@/components/form";
import { formatBytes } from "@/lib/library/labels";
import { parseGabarito } from "@/lib/training/gabarito";
import { FILE_KINDS, formatMinutes, MIME_BY_EXT, TRAINING_BUCKET, type FileKind } from "@/lib/training/labels";
import { classifyPackage, parseFicha, titleFromFolder, type FichaData, type PackageFile, type PackagePlan } from "@/lib/training/pacote";
import { withBase } from "@/lib/base-path";
import { uploadToSignedUrl } from "@/lib/supabase/browser-upload";
import { importGabaritosAction } from "../avaliacoes-actions";
import { createFromPackageAction, pdfTextAction } from "../pacote-actions";

/** Preparo e registro de cada arquivo pela rota do importador (em paralelo). */
async function fileStep<T extends { error?: string }>(body: Record<string, unknown>): Promise<T> {
  try {
    const res = await fetch(withBase("/treinamentos/importar/arquivo"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json()) as T;
  } catch {
    return { error: "Falha de conexão." } as T;
  }
}

export type ExistingCourse = { id: string; code: string; versions: string[]; hasDraft: boolean };

type ModuleView = {
  position: number;
  title: string;
  objective: string | null;
  content_summary: string | null;
  video_minutes: number | null;
  reading_minutes: number | null;
  activity_minutes: number | null;
  files: PackageFile[];
  objectives: number;
  open: number;
  passScore: number | null;
};
type Analysis = { plan: PackagePlan; ficha: FichaData | null; modules: ModuleView[]; warnings: string[] };
type Phase = "idle" | "reading" | "review" | "importing" | "done";

const mcode = (p: number) => `M${String(p).padStart(2, "0")}`;
const KIND_SHORT: Partial<Record<FileKind, string>> = {
  apostila: "Apostila",
  avaliacao_pdf: "Avaliação (PDF)",
  roteiro: "Roteiro",
  gabarito: "Gabarito",
  slides_pdf: "Slides (PDF)",
};

async function pdfText(zip: JSZip, path: string, layout = false): Promise<{ text: string; layout: string } | null> {
  const blob = await zip.file(path)!.async("blob");
  const fd = new FormData();
  fd.set("file", new File([blob], path.slice(path.lastIndexOf("/") + 1), { type: "application/pdf" }));
  if (layout) fd.set("layout", "1");
  const r = await pdfTextAction(fd);
  return r.text ? { text: r.text, layout: r.layout ?? "" } : null;
}

export function PackageImporter({ existing }: { existing: ExistingCourse[] }) {
  const zipRef = useRef<JSZip | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<Analysis | null>(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [failed, setFailed] = useState<string[]>([]);
  const [result, setResult] = useState<{ courseId: string; versionId: string; questions: string; created: boolean } | null>(null);
  const target = useRef<{ courseId: string; versionId: string; modules: Record<string, string>; sent: Set<string> } | null>(null);

  const course = useMemo(() => existing.find((c) => c.code === code.trim().toUpperCase()), [existing, code]);
  const blocker = !code.trim()
    ? "Informe o código do treinamento."
    : !/^\d{1,2}\.\d{1,2}$/.test(version.trim())
      ? "Informe a versão do material (ex.: 1.2)."
      : course?.hasDraft
        ? `O ${course.code} já tem uma versão em rascunho. Publique ou cancele o rascunho antes de importar.`
        : course?.versions.includes(version.trim())
          ? `A versão ${version.trim()} do ${course.code} já existe. Confira o número da versão no material.`
          : null;

  async function analyze(file: File) {
    setError(null);
    setPhase("reading");
    setFileName(file.name);
    try {
      setStatus("Abrindo o .zip…");
      const zip = await JSZip.loadAsync(file);
      zipRef.current = zip;
      const entries = Object.values(zip.files)
        .filter((f) => !f.dir)
        .map((f) => ({ path: f.name, size: (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0 }));
      const plan = classifyPackage(entries);
      const warnings = [...plan.warnings];
      let ficha: FichaData | null = null;
      const fichaFile = plan.files.find((f) => f.kind === "ficha_tecnica");
      if (fichaFile) {
        setStatus("Lendo a ficha técnica…");
        const t = await pdfText(zip, fichaFile.path, true);
        if (t) ficha = parseFicha(t.text, t.layout);
        else warnings.push("Não foi possível ler o texto da ficha técnica.");
      }
      const modules: ModuleView[] = [];
      for (const m of plan.modules) {
        const fm = ficha?.modules.find((x) => x.position === m);
        const files = plan.files.filter((f) => f.module === m);
        const gab = files.find((f) => f.kind === "gabarito");
        let objectives = 0;
        let open = 0;
        let passScore: number | null = null;
        if (gab) {
          setStatus(`Lendo as questões do ${mcode(m)}…`);
          const t = await pdfText(zip, gab.path);
          if (t) {
            const g = parseGabarito(t.text, m);
            objectives = g.questions.filter((q) => q.kind === "objetiva").length;
            open = g.questions.length - objectives;
            passScore = g.passScore;
            warnings.push(...g.warnings);
          } else warnings.push(`${mcode(m)}: não foi possível ler o gabarito.`);
        }
        const title = fm?.title ?? titleFromFolder(files[0]?.path ?? "", m) ?? (m === 1 ? "Ambientação" : `Módulo ${mcode(m)}`);
        if (!fm && ficha) warnings.push(`${mcode(m)}: não aparece na ficha técnica; título tirado do nome da pasta.`);
        modules.push({
          position: m,
          title,
          objective: fm?.objective ?? null,
          content_summary: fm?.content_summary ?? null,
          video_minutes: fm?.video_minutes ?? null,
          reading_minutes: fm?.reading_minutes ?? null,
          activity_minutes: fm?.activity_minutes ?? null,
          files,
          objectives,
          open,
          passScore,
        });
      }
      setCode(plan.code ?? "");
      setTitle(ficha?.title ?? "");
      setVersion(ficha?.version ?? "");
      setA({ plan, ficha, modules, warnings });
      setPhase("review");
    } catch {
      setError("Não foi possível abrir o arquivo. Confira se é um .zip válido.");
      setPhase("idle");
    }
  }

  async function uploadAll() {
    const t = target.current!;
    const zip = zipRef.current!;
    const files = a!.plan.files.filter((f) => !t.sent.has(f.path));
    const total = a!.plan.files.length;
    const fails: string[] = [];
    let done = t.sent.size;
    const queue = [...files];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        setProgress({ done, total, current: f.name });
        const moduleId = f.module ? t.modules[String(f.module)] : null;
        const ext = f.name.slice(f.name.lastIndexOf(".") + 1).toLowerCase();
        const blob = await zip.file(f.path)!.async("blob");
        const file = new File([blob], f.name, { type: MIME_BY_EXT[ext] ?? "application/octet-stream" });
        const base = { courseId: t.courseId, versionId: t.versionId, kind: f.kind, moduleId, fileName: f.name };
        const prep = await fileStep<{ error?: string; path?: string; token?: string }>({ step: "prepare", ...base, size: file.size });
        let ok = Boolean(prep.path && prep.token);
        if (ok) ok = !(await uploadToSignedUrl(TRAINING_BUCKET, prep.path!, prep.token!, file)).error;
        if (ok) ok = !(await fileStep({ step: "register", ...base, path: prep.path })).error;
        if (ok) t.sent.add(f.path);
        else fails.push(f.name);
        done += 1;
        setProgress({ done, total, current: f.name });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return fails;
  }

  async function finish() {
    const t = target.current!;
    setStatus("Lendo as questões dos gabaritos enviados…");
    const ids = a!.modules.filter((m) => m.objectives + m.open > 0).map((m) => t.modules[String(m.position)]);
    const q = ids.length ? await importGabaritosAction(t.courseId, ids) : { ok: "Nenhum gabarito com questões." };
    setResult({ courseId: t.courseId, versionId: t.versionId, questions: q.error ?? q.ok ?? "", created: true });
    setPhase("done");
  }

  async function runImport() {
    if (!a || blocker) return;
    setError(null);
    setPhase("importing");
    setStatus("Criando o treinamento e os módulos…");
    const f = a.ficha;
    const r = await createFromPackageAction({
      code: code.trim().toUpperCase(),
      title: title.trim() || code.trim().toUpperCase(),
      version: version.trim(),
      ficha: f
        ? {
            workload_minutes: f.workload_minutes,
            instructor_name: f.instructor_name,
            modality: f.modality,
            audience: f.audience,
            prerequisites: f.prerequisites,
            general_objective: f.general_objective,
            methodology: f.methodology,
            assessment_rules: f.assessment_rules,
            important_notice: f.important_notice,
            resources: f.resources,
            references_text: f.references_text,
          }
        : {},
      modules: a.modules.map((m) => ({
        position: m.position,
        title: m.title,
        objective: m.objective,
        content_summary: m.content_summary,
        video_minutes: m.video_minutes,
        reading_minutes: m.reading_minutes,
        activity_minutes: m.activity_minutes,
      })),
    });
    if (r.error || !r.courseId || !r.versionId || !r.modules) {
      setError(r.error ?? "Não foi possível criar o treinamento.");
      setPhase("review");
      return;
    }
    target.current = { courseId: r.courseId, versionId: r.versionId, modules: r.modules, sent: new Set() };
    setStatus("Enviando os arquivos…");
    const fails = await uploadAll();
    setFailed(fails);
    if (fails.length) return;
    await finish();
  }

  async function retry() {
    setFailed([]);
    setStatus("Enviando os arquivos que faltaram…");
    const fails = await uploadAll();
    setFailed(fails);
    if (!fails.length) await finish();
  }

  // -------------------------------------------------------------------------
  if (phase === "done" && result) {
    return (
      <section className="flex max-w-3xl flex-col gap-4 rounded-xl border border-ok/30 bg-white p-5" data-testid="import-done">
        <p className="flex items-center gap-2 text-lg font-semibold text-ok">
          <CheckCircle2 size={22} aria-hidden /> Pacote importado
        </p>
        <p className="text-sm text-ink">
          {code.toUpperCase()} v{version}: {a?.modules.length} módulos e {a?.plan.files.length} arquivos. {result.questions}
        </p>
        <p className="text-sm text-muted">A versão está em rascunho. Confira os módulos, cole os links do YouTube, defina as regras das avaliações e publique.</p>
        <Link href={`/treinamentos/${result.courseId}?v=${result.versionId}`} className="inline-flex self-start rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
          Abrir o treinamento
        </Link>
      </section>
    );
  }

  const busy = phase === "reading" || phase === "importing";
  return (
    <div className="flex flex-col gap-5">
      <section className="max-w-3xl rounded-xl border border-line bg-white p-5">
        <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line px-4 py-8 text-center ${busy ? "pointer-events-none opacity-60" : "hover:border-navy/40"}`}>
          <FileArchive size={28} className="text-navy" aria-hidden />
          <span className="text-sm font-semibold text-ink">{fileName || "Escolher o arquivo .zip do treinamento"}</span>
          <span className="text-xs text-muted">O arquivo é aberto no seu computador; cada material é enviado separadamente (até 50 MB cada).</span>
          <input
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            data-testid="package-input"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyze(f);
              e.target.value = "";
            }}
          />
        </label>
        {busy && (
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            {status}
          </p>
        )}
        {error && (
          <div className="mt-3">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
      </section>

      {a && (phase === "review" || phase === "importing") && (
        <div className="flex flex-col gap-4" data-testid="package-review">
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Treinamento</h2>
            <div className="grid gap-3 sm:grid-cols-[8rem_7rem_1fr]">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Código</span>
                <input value={code} onChange={(e) => setCode(e.target.value)} disabled={phase !== "review"} className="rounded-md border border-line px-3 py-2 uppercase" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Versão</span>
                <input value={version} onChange={(e) => setVersion(e.target.value)} disabled={phase !== "review"} className="rounded-md border border-line px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Título</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={phase !== "review"} className="rounded-md border border-line px-3 py-2" />
              </label>
            </div>
            <p className="mt-3 text-sm text-muted" data-testid="package-target">
              {course ? `Nova versão do ${course.code}, que já existe (versões ${course.versions.join(", ")}).` : "Treinamento novo."}{" "}
              {a.ficha
                ? [
                    a.ficha.workload_minutes ? `Carga horária ${formatMinutes(a.ficha.workload_minutes)}` : null,
                    a.ficha.instructor_name ? `instrutor ${a.ficha.instructor_name}` : null,
                    "objetivos, metodologia, avaliação, recursos e referências lidos da ficha técnica",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Sem ficha técnica: preencha a ficha depois da importação."}
            </p>
          </section>

          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink" data-testid="package-summary">
              {a.modules.length} módulos · {a.plan.files.length} arquivos ({formatBytes(a.plan.files.reduce((s, f) => s + f.size, 0))}) ·{" "}
              {a.modules.reduce((s, m) => s + m.objectives + m.open, 0)} questões
            </h2>
            <ol className="divide-y divide-line">
              {a.modules.map((m) => {
                const kinds = new Set(m.files.map((f) => f.kind));
                const imgs = m.files.filter((f) => f.kind === "slide_imagem").length;
                const mins = (m.video_minutes ?? 0) + (m.reading_minutes ?? 0) + (m.activity_minutes ?? 0);
                return (
                  <li key={m.position} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:gap-4">
                    <span className="w-10 shrink-0 text-sm font-bold text-navy">{mcode(m.position)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {m.title}
                        {mins ? <span className="font-normal text-muted"> · {formatMinutes(mins)}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {Object.entries(KIND_SHORT)
                          .map(([k, label]) => `${kinds.has(k as FileKind) ? "✓" : "✗"} ${label}`)
                          .join(" · ")}
                        {` · ${imgs} ${imgs === 1 ? "imagem" : "imagens"} de slides`}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink sm:w-44 sm:text-right">
                      {m.objectives + m.open ? `${m.objectives} objetivas, ${m.open} abertas` : "sem questões"}
                      {m.passScore ? ` · nota mínima ${m.passScore}` : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
            {a.plan.files.some((f) => !f.module) && (
              <p className="border-t border-line px-5 py-3 text-xs text-muted">
                Documentos do treinamento:{" "}
                {a.plan.files
                  .filter((f) => !f.module)
                  .map((f) => FILE_KINDS[f.kind].label)
                  .join(" · ")}
              </p>
            )}
          </section>

          {(a.warnings.length > 0 || a.plan.ignored.length > 0) && (
            <section className="rounded-xl border border-warn/40 bg-white p-5" data-testid="package-warnings">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-warn">
                <TriangleAlert size={16} aria-hidden /> Avisos
              </h2>
              <ul className="flex flex-col gap-1 text-sm text-ink">
                {a.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {a.plan.ignored.map((f) => (
                  <li key={f.path} className="text-muted">
                    Fica de fora: {f.path.slice(f.path.lastIndexOf("/") + 1)} ({f.reason})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {phase === "importing" ? (
            <section className="rounded-xl border border-line bg-white p-5" aria-live="polite" data-testid="import-progress">
              <p className="text-sm font-semibold text-ink">{status}</p>
              {progress.total > 0 && (
                <>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-2 bg-green transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {progress.done} de {progress.total} arquivos · {progress.current}
                  </p>
                </>
              )}
              {failed.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <Alert kind="error">
                    {failed.length} {failed.length === 1 ? "arquivo não foi enviado" : "arquivos não foram enviados"}: {failed.slice(0, 5).join(", ")}
                    {failed.length > 5 ? "…" : ""}
                  </Alert>
                  <button type="button" onClick={() => void retry()} className="self-start rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">
                    Tentar de novo os que faltaram
                  </button>
                </div>
              )}
            </section>
          ) : (
            <div className="flex flex-col gap-2">
              {blocker && <Alert kind="warning">{blocker}</Alert>}
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={Boolean(blocker)}
                className="self-start rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                data-testid="package-import"
              >
                Importar {code.toUpperCase()} v{version}: {a.modules.length} módulos e {a.plan.files.length} arquivos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
