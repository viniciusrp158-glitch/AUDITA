import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import { capaDoCurso } from "@/lib/academy";
import { createClient } from "@/lib/supabase/server";
import { AreaAluno } from "../shell";
import { dataBR, situacao, TOM, type MatriculaHist } from "./util";

export const metadata = { title: "Histórico de cursos" };
export const dynamic = "force-dynamic";

const horas = (min: number | null | undefined) => (min ? (min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`) : null);

/** Histórico de cursos (Audita Academy, etapa 5): todos os cursos do aluno, inclusive concluídos e encerrados. */
export default async function HistoricoPage() {
  const supabase = await createClient();
  const [{ data }, { data: certs }] = await Promise.all([
    supabase
      .from("training_enrollments")
      .select("id, status, starts_on, access_until, access_revoked_at, completed_at, training_courses(course_code, title), training_versions(title, workload_minutes)")
      .order("created_at", { ascending: false }),
    supabase.from("training_certificates").select("enrollment_id, code, status"),
  ]);
  const rows = (data ?? []) as unknown as MatriculaHist[];
  const certificado = new Map(((certs ?? []) as { enrollment_id: string; code: string; status: string }[]).filter((c) => c.status === "valido").map((c) => [c.enrollment_id, c.code]));

  return (
    <AreaAluno ativo="historico" largura="max-w-4xl">
      <div>
        <h1 className="font-display text-[28px] leading-tight font-extrabold text-navy">Histórico de cursos</h1>
        <p className="mt-1 text-sm text-muted">Todos os seus cursos, com os módulos feitos, as notas e o certificado.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">Você ainda não fez nenhum curso.</p>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="historico">
          {rows.map((r) => {
            const s = situacao(r);
            const code = r.training_courses?.course_code ?? "";
            const cert = certificado.get(r.id);
            return (
              <li key={r.id}>
                <Link
                  href={`/historico/${r.id}`}
                  className="group grid overflow-hidden rounded-2xl border border-line bg-white hover:border-navy sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capaDoCurso(code)} alt="" className="hidden h-full w-full object-cover sm:block" />
                  <span className="flex min-w-0 flex-col gap-2 p-5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold text-white">{code}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOM[s.tom]}`}>{s.rotulo}</span>
                      {cert && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-2.5 py-0.5 text-xs font-semibold text-green-dark">
                          <Award size={13} aria-hidden /> Certificado
                        </span>
                      )}
                    </span>
                    <span className="font-display text-lg leading-snug font-bold text-navy">{r.training_versions?.title ?? r.training_courses?.title}</span>
                    <span className="text-sm text-muted">
                      {[horas(r.training_versions?.workload_minutes), `Início em ${dataBR(r.starts_on)}`, r.completed_at && `Concluído em ${dataBR(r.completed_at)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight size={22} className="mr-5 hidden text-muted transition group-hover:translate-x-1 sm:block motion-reduce:transition-none" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AreaAluno>
  );
}
