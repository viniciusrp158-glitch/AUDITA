import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { CodeBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { FILE_KINDS, MODULE_SLIDE_KINDS, MODULE_STAFF_KINDS, moduleCode, VERSION_STATUS, type FileKind } from "@/lib/training/labels";
import { getCourseDetail, type TrainingFile } from "@/lib/training/queries";
import { updateModuleAction } from "../../../actions";
import { FileSlot, ModuleControls, ModuleForm, VideoLink } from "../../forms";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Módulo · Treinamentos" };

function Box({ step, title, audience, children }: { step?: string; title: string; audience: "aluno" | "equipe"; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-green-dark">
          {step ? `${step} · ` : ""}
          {title}
        </h2>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${audience === "aluno" ? "bg-ok/10 text-ok" : "bg-surface text-muted"}`}>
          {audience === "aluno" ? "Aluno" : "Só equipe"}
        </span>
      </div>
      {children}
    </section>
  );
}

export default async function ModuloPage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const { id, moduleId } = await params;
  if (!uuidRe.test(moduleId)) notFound();
  const supabase = await createClient();
  const { data: ref } = await supabase.from("training_modules").select("version_id").eq("id", moduleId).maybeSingle();
  if (!ref) notFound();
  const { course, version, modules, files } = await getCourseDetail(id, ref.version_id);
  if (!version || version.id !== ref.version_id) notFound();
  const idx = modules.findIndex((m) => m.id === moduleId);
  if (idx < 0) notFound();
  const m = modules[idx];
  const readOnly = version.status !== "rascunho";
  const mine = files.filter((f) => f.module_id === m.id);
  const of = (k: FileKind): TrainingFile[] => mine.filter((f) => f.kind === k);
  const slot = (k: FileKind) => <FileSlot courseId={course.id} versionId={version.id} moduleId={m.id} kind={k} readOnly={readOnly} files={of(k)} />;
  const prev = modules[idx - 1];
  const next = modules[idx + 1];

  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link href="/treinamentos" className="hover:text-navy">
          Treinamentos
        </Link>{" "}
        ›{" "}
        <Link href={`/treinamentos/${course.id}?v=${version.id}`} className="hover:text-navy">
          {course.course_code} v{version.version_label}
        </Link>{" "}
        › {moduleCode(m.position)}
      </p>

      <header className="mb-5 flex flex-wrap items-start gap-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${m.is_orientation ? "bg-green text-navy" : "bg-navy text-white"}`}>
          {moduleCode(m.position)}
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <CodeBadge code={course.course_code} />
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERSION_STATUS[version.status].cls}`}>
              Versão {version.version_label} · {VERSION_STATUS[version.status].label}
            </span>
            {m.status === "inativo" && <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">Módulo inativo</span>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-ink">{m.title}</h1>
          {m.is_orientation && <p className="mt-1 text-sm text-muted">Módulo de Ambientação: instruções da plataforma e do curso. A ficha técnica é entregue ao aluno aqui.</p>}
        </div>
        {!readOnly && (
          <ModuleControls courseId={course.id} moduleId={m.id} canUp={Boolean(prev && !prev.is_orientation)} canDown={Boolean(next)} status={m.status} isOrientation={m.is_orientation} />
        )}
      </header>

      {readOnly && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-muted">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>Versão {VERSION_STATUS[version.status].label.toLowerCase()}: somente consulta. Para alterar, crie uma nova versão.</span>
        </div>
      )}

      <div className="mb-5 grid gap-3 md:grid-cols-3" data-testid="module-steps">
        <Box step="1" title="Apostila / e-book" audience="aluno">
          {slot("apostila")}
        </Box>
        <Box step="2" title="Videoaula (YouTube)" audience="aluno">
          <VideoLink url={m.video_url} />
          <p className="text-xs text-muted">O link é informado no formulário abaixo.</p>
        </Box>
        <Box step="3" title="Avaliação" audience="aluno">
          <p className="text-sm text-muted">As questões, o tempo de prova e as tentativas entram na próxima etapa (importação do pacote e banco de questões).</p>
        </Box>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Box title="Material do instrutor" audience="equipe">
          <div className="flex flex-col gap-4">
            {MODULE_STAFF_KINDS.map((k) => (
              <div key={k}>
                <p className="mb-1 text-sm font-semibold text-ink">{FILE_KINDS[k].label}</p>
                {slot(k)}
              </div>
            ))}
          </div>
        </Box>
        <Box title="Slides" audience="equipe">
          <div className="flex flex-col gap-4">
            {MODULE_SLIDE_KINDS.map((k) => (
              <div key={k}>
                <p className="mb-1 text-sm font-semibold text-ink">{FILE_KINDS[k].label}</p>
                {slot(k)}
              </div>
            ))}
          </div>
        </Box>
      </div>

      <section className="max-w-4xl rounded-xl border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Dados do módulo</h2>
        <ModuleForm
          action={updateModuleAction.bind(null, course.id, m.id)}
          readOnly={readOnly}
          initial={{
            title: m.title,
            objective: m.objective ?? "",
            content_summary: m.content_summary ?? "",
            video_minutes: m.video_minutes?.toString() ?? "",
            reading_minutes: m.reading_minutes?.toString() ?? "",
            activity_minutes: m.activity_minutes?.toString() ?? "",
            video_url: m.video_url ?? "",
          }}
        />
      </section>

      <nav className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
        {prev ? (
          <Link href={`/treinamentos/${course.id}/modulo/${prev.id}`} className="font-semibold text-navy hover:underline">
            ← {moduleCode(prev.position)} · {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/treinamentos/${course.id}/modulo/${next.id}`} className="font-semibold text-navy hover:underline">
            {moduleCode(next.position)} · {next.title} →
          </Link>
        )}
      </nav>
    </>
  );
}
