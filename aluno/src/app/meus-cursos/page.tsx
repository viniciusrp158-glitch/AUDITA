import Link from "next/link";
import { ArrowRight, Award, BookOpen, Clock, MessageCircle } from "lucide-react";
import { capaDoCurso, whatsapp } from "@/lib/academy";
import { loadCourse, mm, resumePoint, STEP_LABEL, stepHref, type CourseData } from "@/lib/curso";
import { createClient, currentStudent } from "@/lib/supabase/server";
import { StudentHeader } from "../shell";

export const metadata = { title: "Meus cursos" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: "ativa" | "suspensa" | "cancelada" | "concluida";
  access_until: string | null;
  access_revoked_at: string | null;
  version_id: string;
  training_courses: { course_code: string; title: string } | null;
  training_versions: { title: string; workload_minutes: number | null } | null;
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hours(min: number | null | undefined) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

function Barra({ pct, escura = false }: { pct: number; escura?: boolean }) {
  return (
    <span className={`block h-2 overflow-hidden rounded-full ${escura ? "bg-white/20" : "bg-chip"}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-green-dark),var(--color-green))]" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Início do aluno (Audita Academy, etapa 4): continuar de onde parou, cursos com progresso e ajuda. */
export default async function MeusCursosPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const sp = await searchParams;
  const student = await currentStudent();
  if (!student) {
    return (
      <>
        <StudentHeader />
        <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
          <h1 className="font-display text-xl font-bold text-ink">Esta conta não tem cursos</h1>
          <p className="mt-2 text-sm text-muted">Se você recebeu um convite, entre com o mesmo e-mail do convite. Em caso de dúvida, fale com a AUDITA.</p>
        </main>
      </>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_enrollments")
    .select("id, status, access_until, access_revoked_at, version_id, training_courses(course_code, title), training_versions(title, workload_minutes)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const estado = (r: Row) => {
    const expired = r.access_until !== null && r.access_until < today;
    const revoked = r.access_revoked_at !== null;
    const blocked = r.status === "suspensa" || r.status === "cancelada" || expired || revoked;
    const label = revoked
      ? "Acesso encerrado (compra reembolsada)"
      : r.status === "suspensa"
        ? "Acesso suspenso"
        : r.status === "cancelada"
          ? "Matrícula cancelada"
          : expired
            ? "Prazo de acesso encerrado"
            : r.status === "concluida"
              ? "Concluído"
              : "Em andamento";
    return { blocked, label };
  };
  // Progresso pelas mesmas funções do player (RLS do aluno); matrículas bloqueadas não consultam o conteúdo
  const progresso = new Map<string, CourseData>();
  await Promise.all(
    rows
      .filter((r) => !estado(r).blocked)
      .map(async (r) => {
        const c = await loadCourse(r.id);
        if (c) progresso.set(r.id, c);
      }),
  );
  const emAndamento = rows.find((r) => r.status === "ativa" && !estado(r).blocked && progresso.get(r.id) && resumePoint(progresso.get(r.id)!));
  const cont = emAndamento ? progresso.get(emAndamento.id)! : null;
  const ponto = cont ? resumePoint(cont) : null;

  return (
    <>
      <StudentHeader name={student.full_name} />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
        {sp.bemvindo && (
          <p role="status" className="rounded-xl border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Senha salva. Boas-vindas à Audita Academy!
          </p>
        )}
        <div>
          <p className="text-sm text-muted">Olá, {student.full_name.split(" ")[0]}</p>
          <h1 className="font-display text-[28px] leading-tight font-extrabold text-navy">{cont ? "Bom te ver de novo" : "Seus cursos"}</h1>
        </div>

        {cont && ponto && (
          <section className="grid overflow-hidden rounded-2xl bg-navy text-white md:grid-cols-[280px_minmax(0,1fr)]" aria-label="Continuar de onde parei">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capaDoCurso(cont.courseCode)} alt="" className="h-40 w-full object-cover md:h-full" />
            <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-6">
              <span className="self-start rounded-full bg-green px-3 py-1 text-xs font-semibold tracking-[0.05em] text-navy uppercase">Continuar de onde parei</span>
              <h2 className="font-display text-xl leading-snug font-bold">{cont.title}</h2>
              <p className="text-[15px] text-white/80">
                Módulo {mm(ponto.module.position)} · {ponto.module.title} · {STEP_LABEL[ponto.step]}
              </p>
              <Barra pct={cont.pct} escura />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-white/85">
                  {cont.done} de {cont.total} módulos concluídos · {cont.pct}%
                </span>
                <Link
                  href={stepHref(cont.enrollmentId, ponto.module.module_id, ponto.step)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-green px-6 font-semibold text-navy hover:bg-[#8cc912]"
                  data-testid="resume-course"
                >
                  Continuar <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="meus-titulo" className="flex flex-col gap-4">
          <h2 id="meus-titulo" className="font-display text-xl font-bold text-navy">
            Meus cursos
          </h2>
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
              Você ainda não tem matrícula ativa.{" "}
              <Link href="/cursos" className="font-semibold text-green-dark underline-offset-4 hover:underline">
                Conheça os cursos
              </Link>
            </p>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="my-courses">
              {rows.map((r) => {
                const { blocked, label } = estado(r);
                const c = progresso.get(r.id);
                const code = r.training_courses?.course_code ?? "";
                return (
                  <li key={r.id} className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-white ${blocked ? "opacity-70" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={capaDoCurso(code)} alt="" className="aspect-[16/9] w-full object-cover" />
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold text-white">{code}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${blocked ? "bg-surface text-muted" : "bg-ok/10 text-ok"}`}>{label}</span>
                      </p>
                      <h3 className="font-display text-lg leading-snug font-bold text-navy">{r.training_versions?.title ?? r.training_courses?.title}</h3>
                      {c && (
                        <div className="flex flex-col gap-1.5">
                          <Barra pct={c.pct} />
                          <span className="text-xs text-muted">
                            {c.done} de {c.total} módulos · {c.pct}%
                          </span>
                        </div>
                      )}
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {hours(r.training_versions?.workload_minutes) && (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={14} aria-hidden /> {hours(r.training_versions?.workload_minutes)}
                          </span>
                        )}
                        <span>{r.access_until ? `Acesso até ${fmtDate(r.access_until)}` : "Acesso sem prazo"}</span>
                      </p>
                      {blocked ? (
                        <span className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-muted">
                          <BookOpen size={16} aria-hidden /> Indisponível
                        </span>
                      ) : (
                        <Link
                          href={r.status === "concluida" ? `/curso/${r.id}/certificado` : `/curso/${r.id}`}
                          className={`mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold ${
                            r.status === "concluida" ? "bg-green text-navy hover:bg-[#8cc912]" : "bg-navy text-white hover:bg-navy-700"
                          }`}
                          data-testid="open-course"
                        >
                          {r.status === "concluida" ? <Award size={16} aria-hidden /> : <BookOpen size={16} aria-hidden />}
                          {r.status === "concluida" ? "Ver certificado" : "Abrir o curso"}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-5 md:grid-cols-2" aria-label="Mais opções">
          <Link href="/cursos" className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5 hover:border-navy">
            <span>
              <span className="font-display block font-bold text-navy">Conheça outros cursos</span>
              <span className="text-sm text-muted">Veja o catálogo da Audita Academy.</span>
            </span>
            <ArrowRight size={20} className="shrink-0 text-green-dark transition group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
          </Link>
          <a
            href={whatsapp(`Olá! Sou aluno(a) da Audita Academy (${student.full_name}) e preciso de ajuda.`)}
            target="_blank"
            rel="noopener"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5 hover:border-navy"
          >
            <span>
              <span className="font-display block font-bold text-navy">Precisa de ajuda?</span>
              <span className="text-sm text-muted">Fale com a AUDITA pelo WhatsApp.</span>
            </span>
            <MessageCircle size={20} className="shrink-0 text-green-dark" aria-hidden />
          </a>
        </section>
      </main>
    </>
  );
}
