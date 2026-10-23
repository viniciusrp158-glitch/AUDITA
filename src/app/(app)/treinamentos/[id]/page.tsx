import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Lock } from "lucide-react";
import { Alert } from "@/components/form";
import { CodeBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { formatBRL } from "@/lib/pricing/engine";
import { COURSE_KINDS, FILE_KINDS, formatMinutes, moduleCode, VERSION_STATUS } from "@/lib/training/labels";
import { formatDay } from "@/lib/format";
import { getAssessments, getAttemptHistory, getCourseDetail, getEnrollmentProgress, listEnrollments, type Assessment, type TrainingFile, type TrainingModule } from "@/lib/training/queries";
import {
  addModuleAction,
  cancelVersionAction,
  enrollmentInviteStatus,
  newVersionAction,
  publishVersionAction,
  updateCommercialAction,
  updateFichaAction,
} from "../actions";
import { AddModuleForm, CancelVersionForm, CommercialForm, FichaForm, FileSlot, NewVersionForm, PublishForm } from "./forms";
import { EnrollmentList, EnrollPanel, type EnrollmentView } from "./alunos";
import { GabaritoReader } from "./avaliacoes";

async function StudentsTab({ courseId, accessDays, published }: { courseId: string; accessDays: number | null; published: boolean }) {
  const [{ rows }, invite, progress, attempts] = await Promise.all([
    listEnrollments(courseId),
    enrollmentInviteStatus(courseId),
    getEnrollmentProgress(courseId),
    getAttemptHistory(courseId),
  ]);
  const view: EnrollmentView[] = rows
    .filter((r) => r.training_students)
    .map((r) => ({
      id: r.id,
      studentId: r.training_students!.id,
      name: r.training_students!.full_name,
      email: r.training_students!.email,
      company: r.training_students!.company,
      status: r.status,
      source: r.source,
      accessUntil: r.access_until,
      accessLabel: r.access_until ? `Acesso de ${formatDay(r.starts_on)} a ${formatDay(r.access_until)}` : `Acesso desde ${formatDay(r.starts_on)}, sem prazo`,
      createdLabel: formatDateTime(r.created_at),
      version: r.training_versions?.version_label ?? "",
      passwordCreated: invite[r.id] ? invite[r.id].senha_criada : null,
      lastAccess: invite[r.id]?.ultimo_acesso ? formatDateTime(invite[r.id].ultimo_acesso!) : null,
      note: r.status_note,
      progress: progress[r.id] ?? null,
      attempts: (attempts[r.id] ?? []).map((t) => ({
        module: moduleCode(t.training_assessments?.training_modules?.position ?? 0),
        number: t.attempt_number,
        when: formatDateTime(t.submitted_at ?? t.started_at),
        result:
          t.status === "em_andamento"
            ? "em andamento"
            : `${t.max_score ? `${t.score}/${t.max_score}` : "enviada"}${t.training_assessments?.pass_score ? (t.passed ? " · aprovada" : " · reprovada") : ""}${t.submitted_by_timeout ? " · tempo esgotado" : ""}`,
      })),
    }));
  return (
    <div className="flex flex-col gap-4">
      <EnrollPanel courseId={courseId} canEnroll={published} defaultAccess={accessDays ? `vazio = ${accessDays} dias` : "vazio = sem prazo"} />
      <EnrollmentList courseId={courseId} rows={view} />
    </div>
  );
}

const TABS = [
  { key: "modulos", label: "Módulos e materiais" },
  { key: "ficha", label: "Ficha técnica" },
  { key: "documentos", label: "Documentos do treinamento" },
  { key: "alunos", label: "Alunos" },
  { key: "venda", label: "Venda e preço" },
  { key: "versoes", label: "Versões" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { course } = await getCourseDetail(id);
  return { title: `${course.course_code} · Treinamentos` };
}

function Chip({ ok, children, muted }: { ok?: boolean; muted?: boolean; children: React.ReactNode }) {
  const cls = muted ? "bg-surface text-muted" : ok ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function moduleMinutes(m: TrainingModule): number | null {
  const parts = [m.video_minutes, m.reading_minutes, m.activity_minutes];
  return parts.some((p) => p != null) ? parts.reduce<number>((s, p) => s + (p ?? 0), 0) : null;
}

function ModuleCard({ courseId, m, files, assessment }: { courseId: string; m: TrainingModule; files: TrainingFile[]; assessment?: Assessment }) {
  const mine = files.filter((f) => f.module_id === m.id);
  const has = (k: string) => mine.some((f) => f.kind === k);
  const slides = mine.filter((f) => f.kind === "slide_imagem").length;
  const total = moduleMinutes(m);
  const qs = (assessment?.training_questions ?? []).filter((q) => q.status === "ativo").length;
  return (
    <li className={`rounded-xl border bg-white p-4 sm:p-5 ${m.status === "inativo" ? "border-dashed border-line opacity-70" : "border-line"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${m.is_orientation ? "bg-green text-navy" : "bg-navy text-white"}`}>
          {moduleCode(m.position)}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-base font-semibold leading-snug text-ink">
            {m.title}
            {m.status === "inativo" && <span className="ml-2 text-xs font-semibold text-muted">(inativo)</span>}
          </p>
          <p className="text-sm text-muted">
            {m.is_orientation ? "Módulo de ambientação (obrigatório) · " : ""}
            {total != null ? formatMinutes(total) : "Tempo a definir"}
          </p>
        </div>
        <Link
          href={`/treinamentos/${courseId}/modulo/${m.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-navy transition hover:border-navy/40"
        >
          Abrir módulo <ArrowRight size={14} />
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip ok={has("apostila")}>1 · Apostila {has("apostila") ? "✓" : "pendente"}</Chip>
        <Chip ok={Boolean(m.video_url)}>2 · Vídeo {m.video_url ? "✓" : "pendente"}</Chip>
        <Chip ok={qs > 0}>
          3 · Avaliação {qs ? `${qs} ${qs === 1 ? "questão" : "questões"}${assessment?.pass_score ? ` · nota ${assessment.pass_score}` : ""}` : "pendente"}
        </Chip>
        <Chip muted>
          Equipe: {[has("roteiro") && "roteiro", has("gabarito") && "gabarito", has("slides_pdf") && "slides", slides && `${slides} imagens`].filter(Boolean).join(" · ") || "nada enviado"}
        </Chip>
      </div>
    </li>
  );
}

function bumpVersion(label: string): string {
  const [a, b] = label.split(".").map(Number);
  return b >= 99 ? `${a + 1}.0` : `${a}.${b + 1}`;
}

export default async function TreinamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; v?: string; criado?: string; publicada?: string; cancelada?: string; nova?: string }>;
}) {
  await requireAppUser(ADMIN_ONLY);
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.aba) ? (sp.aba as Tab) : "modulos";
  const { course, versions, version, modules, files } = await getCourseDetail(id, sp.v);
  const draft = versions.find((v) => v.status === "rascunho");
  const published = versions.find((v) => v.status === "publicada");
  const readOnly = !version || version.status !== "rascunho";
  const vq = sp.v && version ? `&v=${version.id}` : "";
  const assessments = version ? await getAssessments(version.id) : {};

  const active = modules.filter((m) => m.status === "ativo");
  const apostilas = active.filter((m) => files.some((f) => f.module_id === m.id && f.kind === "apostila")).length;
  const videos = active.filter((m) => m.video_url).length;
  const withQs = active.filter((m) => (assessments[m.id]?.training_questions ?? []).some((q) => q.status === "ativo")).length;
  const checks = [
    { ok: Boolean(version?.workload_minutes), label: version?.workload_minutes ? `Carga horária: ${formatMinutes(version.workload_minutes)}` : "Carga horária não informada (ficha técnica)" },
    { ok: active.length > 1, label: `${active.length} módulo(s) ativo(s), Ambientação incluída` },
    { ok: active.length > 0 && apostilas === active.length, label: `Apostilas: ${apostilas} de ${active.length}` },
    { ok: files.some((f) => f.kind === "ficha_tecnica"), label: "Ficha técnica em PDF (vai para o aluno no M01)" },
    { ok: active.length > 0 && withQs === active.length, label: `Avaliações com questões: ${withQs} de ${active.length}` },
    { ok: active.length > 0 && videos === active.length, label: `Links do YouTube: ${videos} de ${active.length} (pode completar depois)` },
    { ok: course.price !== null, label: course.price !== null ? `Preço: ${formatBRL(course.price)}` : "Preço PENDENTE (venda numa etapa seguinte)" },
  ];

  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link href="/treinamentos" className="hover:text-navy">
          Treinamentos
        </Link>{" "}
        › {course.course_code}
      </p>

      {sp.criado && <div className="mb-4"><Alert kind="info">Treinamento cadastrado. O Módulo 01 (Ambientação) já foi criado; inclua os demais módulos e envie os materiais.</Alert></div>}
      {sp.publicada && <div className="mb-4"><Alert kind="info">Versão publicada. Ela está congelada; para mudanças, crie uma nova versão.</Alert></div>}
      {sp.cancelada && <div className="mb-4"><Alert kind="info">Rascunho cancelado. O registro e os arquivos continuam no histórico.</Alert></div>}
      {sp.nova && <div className="mb-4"><Alert kind="info">Nova versão criada a partir da publicada, com os mesmos módulos e materiais. Edite e publique quando estiver pronta.</Alert></div>}

      <header className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex flex-wrap items-center gap-2">
            <CodeBadge code={course.course_code} />
            {version && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERSION_STATUS[version.status].cls}`}>
                Versão {version.version_label} · {VERSION_STATUS[version.status].label}
              </span>
            )}
            {course.status === "inativo" && <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">Inativo</span>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-ink">{version?.title ?? course.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[
              version?.workload_minutes ? formatMinutes(version.workload_minutes) : null,
              `${active.length} ${active.length === 1 ? "módulo" : "módulos"}`,
              version?.instructor_name ? `Instrutor: ${version.instructor_name}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {versions.length > 1 && (
          <nav aria-label="Versões" className="flex flex-wrap gap-1.5">
            {versions.map((v) => (
              <Link
                key={v.id}
                href={`/treinamentos/${course.id}?aba=${tab}&v=${v.id}`}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${v.id === version?.id ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/40"}`}
              >
                v{v.version_label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {readOnly && version && tab !== "venda" && tab !== "versoes" && tab !== "alunos" && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-muted">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Versão {version.version_label} {VERSION_STATUS[version.status].label.toLowerCase()}: somente consulta.{" "}
            {draft ? (
              <Link href={`/treinamentos/${course.id}?aba=${tab}&v=${draft.id}`} className="font-semibold text-navy hover:underline">
                Ir para o rascunho v{draft.version_label}
              </Link>
            ) : (
              <Link href={`/treinamentos/${course.id}?aba=versoes`} className="font-semibold text-navy hover:underline">
                Criar nova versão
              </Link>
            )}
          </span>
        </div>
      )}

      <nav role="tablist" aria-label="Seções do treinamento" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={t.key === tab}
            href={`/treinamentos/${course.id}?aba=${t.key}${vq}`}
            className={`shrink-0 border-b-[3px] px-3 py-2.5 text-sm transition ${t.key === tab ? "border-green font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!version ? (
        <Alert kind="warning">Este treinamento não tem versão ativa. Crie uma nova versão na aba Versões.</Alert>
      ) : tab === "modulos" ? (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
            <ol className="flex flex-col gap-3" data-testid="module-list">
              {modules.map((m) => (
                <ModuleCard key={m.id} courseId={course.id} m={m} files={files} assessment={assessments[m.id]} />
              ))}
            </ol>
            {!readOnly && (
              <section className="rounded-xl border border-dashed border-line bg-white p-4">
                <AddModuleForm action={addModuleAction.bind(null, course.id, version.id)} />
              </section>
            )}
          </div>
          <aside className="flex flex-[1_1_280px] flex-col gap-3">
            <section className="rounded-xl border border-line bg-white p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Antes de publicar</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className={`flex items-start gap-2 ${c.ok ? "text-ok" : "text-warn"}`}>
                    {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> : <CircleDashed size={16} className="mt-0.5 shrink-0" aria-hidden />}
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </section>
            {!readOnly && (
              <section className="rounded-xl border border-line bg-white p-4">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Questões das avaliações</h2>
                <p className="mb-3 text-sm text-muted">Lê o “Gabarito comentado” de cada módulo e mostra a conferência antes de gravar.</p>
                <GabaritoReader courseId={course.id} versionId={version.id} label="Ler os gabaritos de todos os módulos" />
              </section>
            )}
            <section className="rounded-xl border border-line bg-white p-4 text-sm text-muted">
              Cada módulo segue <strong className="text-ink">Apostila → Videoaula → Avaliação</strong>. O aluno avança um módulo por vez; o certificado sai ao concluir todos.
            </section>
          </aside>
        </div>
      ) : tab === "ficha" ? (
        <section className="max-w-4xl rounded-xl border border-line bg-white p-5">
          <FichaForm
            action={updateFichaAction.bind(null, course.id, version.id)}
            readOnly={readOnly}
            initial={{
              title: version.title,
              summary: version.summary,
              modality: version.modality,
              workload_minutes: version.workload_minutes?.toString() ?? null,
              audience: version.audience,
              prerequisites: version.prerequisites,
              general_objective: version.general_objective,
              methodology: version.methodology,
              assessment_rules: version.assessment_rules,
              resources: version.resources,
              references_text: version.references_text,
              important_notice: version.important_notice,
              instructor_name: version.instructor_name,
            }}
          />
        </section>
      ) : tab === "documentos" ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {COURSE_KINDS.map((k) => (
            <li key={k} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{FILE_KINDS[k].label}</h2>
                <Chip ok={FILE_KINDS[k].audience === "aluno"} muted={FILE_KINDS[k].audience === "equipe"}>
                  {FILE_KINDS[k].audience === "aluno" ? "Aluno" : "Só equipe"}
                </Chip>
              </div>
              <p className="mb-3 text-xs text-muted">{FILE_KINDS[k].hint}</p>
              <FileSlot courseId={course.id} versionId={version.id} moduleId={null} kind={k} readOnly={readOnly} files={files.filter((f) => f.kind === k && !f.module_id)} />
            </li>
          ))}
        </ul>
      ) : tab === "alunos" ? (
        <StudentsTab courseId={course.id} accessDays={course.access_days} published={Boolean(published)} />
      ) : tab === "venda" ? (
        <section className="max-w-3xl rounded-xl border border-line bg-white p-5">
          <CommercialForm
            action={updateCommercialAction.bind(null, course.id)}
            initial={{
              title: course.title,
              price: course.price === null ? "" : String(course.price).replace(".", ","),
              access_days: course.access_days?.toString() ?? "",
              status: course.status,
              notes: course.notes ?? "",
              on_sale: course.on_sale ? "on" : "",
            }}
          />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2" data-testid="version-list">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-ink">v{v.version_label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERSION_STATUS[v.status].cls}`}>{VERSION_STATUS[v.status].label}</span>
                <span className="text-muted">{v.published_at ? `Publicada em ${formatDateTime(v.published_at)}` : `Criada em ${formatDateTime(v.created_at)}`}</span>
                {v.status_note && <span className="text-muted">· {v.status_note}</span>}
                <Link href={`/treinamentos/${course.id}?aba=modulos&v=${v.id}`} className="ml-auto font-semibold text-navy hover:underline">
                  Ver
                </Link>
              </li>
            ))}
          </ul>
          {draft ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-line bg-white p-5">
                <h2 className="mb-1 text-sm font-semibold text-ink">Publicar a versão {draft.version_label}</h2>
                <p className="mb-3 text-sm text-muted">
                  Exige carga horária, pelo menos um módulo além da Ambientação e a apostila em todos os módulos ativos.
                  {published ? ` A versão ${published.version_label} passa a substituída.` : ""}
                </p>
                <PublishForm action={publishVersionAction.bind(null, course.id, draft.id)} />
              </section>
              <section className="rounded-xl border border-line bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Cancelar o rascunho {draft.version_label}</h2>
                <CancelVersionForm action={cancelVersionAction.bind(null, course.id, draft.id)} />
              </section>
            </div>
          ) : published ? (
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="mb-1 text-sm font-semibold text-ink">Atualizar materiais</h2>
              <p className="mb-3 text-sm text-muted">A nova versão copia a ficha técnica, os módulos e os arquivos da versão {published.version_label}; a publicada continua valendo até a nova ser publicada.</p>
              <NewVersionForm action={newVersionAction.bind(null, course.id)} suggestion={bumpVersion(published.version_label)} />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
