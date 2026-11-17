import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Check, Minus } from "lucide-react";
import { isUuid } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "../../curso/[matricula]/certificado/print-button";
import { AreaAluno } from "../../shell";
import { Copiar } from "../copiar";
import { dataBR, situacao, TOM, type MatriculaHist } from "../util";

export const metadata = { title: "Histórico do curso" };
export const dynamic = "force-dynamic";

type Linha = {
  module_id: string;
  position: number;
  title: string;
  completed: boolean;
  completed_at: string | null;
  has_assessment: boolean;
  pass_score: number | null;
  attempts: number;
  best_score: number | null;
  max_score: number | null;
  passed: boolean | null;
};

const BASE_PUBLICA = (process.env.ALUNO_PUBLIC_URL ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");

/** Histórico de um curso: módulos feitos com data, notas, tentativas e o certificado (sempre verificável). */
export default async function HistoricoCursoPage({ params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  if (!isUuid(matricula)) notFound();
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("training_enrollments")
    .select("id, status, starts_on, access_until, access_revoked_at, completed_at, training_courses(course_code, title), training_versions(title, workload_minutes)")
    .eq("id", matricula)
    .maybeSingle();
  const m = e as unknown as MatriculaHist | null;
  if (!m) notFound();
  const [{ data: hist }, { data: cert }] = await Promise.all([
    supabase.rpc("training_my_history", { p_enrollment_id: matricula }),
    supabase.from("training_certificates").select("code, issued_at, final_score, final_max_score").eq("enrollment_id", matricula).eq("status", "valido").maybeSingle(),
  ]);
  const linhas = (hist ?? []) as Linha[];
  const s = situacao(m);
  const feitos = linhas.filter((l) => l.completed).length;
  const emVigor = s.rotulo === "Em andamento" || s.rotulo === "Concluído";
  const c = cert as { code: string; issued_at: string; final_score: number | null; final_max_score: number | null } | null;

  return (
    <AreaAluno ativo="historico" largura="max-w-4xl">
      <div className="no-print">
        <Link href="/historico" className="text-sm text-muted underline-offset-4 hover:text-navy hover:underline">
          ← Histórico de cursos
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold text-white">{m.training_courses?.course_code}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOM[s.tom]}`}>{s.rotulo}</span>
        </p>
        <h1 className="font-display text-2xl leading-tight font-extrabold text-navy sm:text-[28px]">{m.training_versions?.title ?? m.training_courses?.title}</h1>
        <p className="text-sm text-muted">
          {[
            `Início em ${dataBR(m.starts_on)}`,
            m.completed_at && `concluído em ${dataBR(m.completed_at)}`,
            m.access_until && `acesso até ${dataBR(m.access_until)}`,
            `${feitos} de ${linhas.length} módulos`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {c && (
        <section className="flex flex-col gap-4 rounded-2xl bg-navy p-5 text-white sm:flex-row sm:items-center sm:p-6" aria-label="Certificado">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-green text-navy" aria-hidden>
            <Award size={28} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-display text-lg font-bold">Certificado emitido em {dataBR(c.issued_at)}</p>
            <p className="text-sm text-white/80">
              Código <span className="font-mono font-semibold text-white">{c.code}</span>
              {c.final_max_score ? ` · avaliação final ${c.final_score} de ${c.final_max_score}` : ""}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Link
              href={emVigor ? `/curso/${m.id}/certificado` : `/certificado/${c.code}`}
              className="inline-flex min-h-11 items-center rounded-full bg-green px-5 text-sm font-semibold text-navy hover:bg-[#8cc912]"
            >
              Ver certificado
            </Link>
          </div>
        </section>
      )}
      {c && (
        <div className="no-print -mt-2 flex flex-wrap gap-2">
          <Copiar texto={c.code} rotulo="Copiar código" />
          <Copiar texto={`${BASE_PUBLICA}/certificado/${c.code}`} rotulo="Copiar link de verificação" />
        </div>
      )}

      <section aria-labelledby="modulos" className="flex flex-col gap-3">
        <h2 id="modulos" className="font-display text-xl font-bold text-navy">
          Módulos e avaliações
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[560px] text-left text-[15px] tabular-nums" data-testid="historico-modulos">
            <thead>
              <tr className="border-b border-line text-xs tracking-[0.05em] text-muted uppercase">
                <th className="px-4 py-3 font-semibold">Módulo</th>
                <th className="px-4 py-3 font-semibold">Concluído em</th>
                <th className="px-4 py-3 font-semibold">Melhor nota</th>
                <th className="px-4 py-3 font-semibold">Tentativas</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.module_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      {l.completed ? <Check size={17} className="shrink-0 text-ok" aria-label="Concluído" /> : <Minus size={17} className="shrink-0 text-muted" aria-label="Não concluído" />}
                      <span>
                        <span className="text-muted">{String(l.position).padStart(2, "0")} · </span>
                        {l.title}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{l.completed_at ? dataBR(l.completed_at) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!l.has_assessment ? (
                      <span className="text-muted">sem avaliação</span>
                    ) : l.best_score === null || !l.max_score ? (
                      <span className="text-muted">{l.attempts ? "sem nota" : "—"}</span>
                    ) : (
                      <span className={l.passed ? "font-semibold text-ok" : "text-ink"}>
                        {l.best_score} de {l.max_score}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{l.has_assessment ? l.attempts : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="no-print flex flex-wrap items-center gap-3">
        <PrintButton rotulo="Baixar histórico em PDF" />
        {emVigor && m.status !== "concluida" && (
          <Link href={`/curso/${m.id}`} className="inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700">
            Continuar o curso
          </Link>
        )}
      </div>
    </AreaAluno>
  );
}
