import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { createClient, currentStudent } from "@/lib/supabase/server";
import { StudentHeader } from "../shell";

export const metadata = { title: "Meus cursos" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: "ativa" | "suspensa" | "cancelada" | "concluida";
  access_until: string | null;
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

export default async function MeusCursosPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const sp = await searchParams;
  const student = await currentStudent();
  if (!student) {
    return (
      <>
        <StudentHeader />
        <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
          <h1 className="text-xl font-semibold text-ink">Esta conta não tem cursos</h1>
          <p className="mt-2 text-sm text-muted">Se você recebeu um convite, entre com o mesmo e-mail do convite. Em caso de dúvida, fale com a AUDITA.</p>
        </main>
      </>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_enrollments")
    .select("id, status, access_until, version_id, training_courses(course_code, title), training_versions(title, workload_minutes)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <StudentHeader name={student.full_name} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {sp.bemvindo && (
          <p role="status" className="mb-5 rounded-md border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">
            Senha salva. Bem-vindo(a) à área do aluno!
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Olá, {student.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">Estes são os seus cursos. Cada módulo segue Apostila → Videoaula → Avaliação.</p>
        {rows.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">Você ainda não tem matrícula ativa.</p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2" data-testid="my-courses">
            {rows.map((r) => {
              const expired = r.access_until !== null && r.access_until < today;
              const blocked = r.status === "suspensa" || r.status === "cancelada" || expired;
              const label = r.status === "suspensa" ? "Acesso suspenso" : r.status === "cancelada" ? "Matrícula cancelada" : expired ? "Prazo de acesso encerrado" : r.status === "concluida" ? "Concluído" : "Em andamento";
              return (
                <li key={r.id} className={`flex flex-col gap-3 rounded-xl border border-line bg-white p-5 ${blocked ? "opacity-70" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold text-white">{r.training_courses?.course_code}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${blocked ? "bg-surface text-muted" : "bg-ok/10 text-ok"}`}>{label}</span>
                  </div>
                  <h2 className="text-lg font-semibold leading-snug text-ink">{r.training_versions?.title ?? r.training_courses?.title}</h2>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    {hours(r.training_versions?.workload_minutes) && (
                      <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {hours(r.training_versions?.workload_minutes)}</span>
                    )}
                    <span>{r.access_until ? `Acesso até ${fmtDate(r.access_until)}` : "Acesso sem prazo"}</span>
                  </p>
                  {blocked ? (
                    <span className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-surface px-4 py-2.5 text-sm font-semibold text-muted">
                      <BookOpen size={16} aria-hidden /> Indisponível
                    </span>
                  ) : (
                    <Link
                      href={r.status === "concluida" ? `/curso/${r.id}/certificado` : `/curso/${r.id}`}
                      className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
                      data-testid="open-course"
                    >
                      <BookOpen size={16} aria-hidden /> {r.status === "concluida" ? "Ver certificado" : "Abrir o curso"}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
