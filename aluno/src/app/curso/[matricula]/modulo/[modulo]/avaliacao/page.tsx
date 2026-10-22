import Link from "next/link";
import { mm, nextAfter, stepHref } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";
import { startAttemptAction } from "../../../../actions";
import { StepButton } from "../../../../step-button";
import { loadStep, ModuleHeader, StepPage } from "../shared";

export const metadata = { title: "Avaliação" };

type Latest = { id: string; status: "em_andamento" | "enviada"; attempt_number: number; passed: boolean | null };

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="text-2xl font-extrabold text-navy">{big}</p>
      <p className="text-[13px] text-muted">{small}</p>
    </div>
  );
}

export default async function AvaliacaoPage({ params }: { params: Promise<{ matricula: string; modulo: string }> }) {
  const { c, m } = await loadStep(params, "avaliacao");
  const supabase = await createClient();
  const [{ data: latestRows }, { count: used }] = await Promise.all([
    supabase.rpc("training_attempt_latest", { p_enrollment_id: c.enrollmentId, p_module_id: m.module_id }),
    supabase.from("training_attempts").select("id", { count: "exact", head: true }).eq("enrollment_id", c.enrollmentId).eq("assessment_id", m.assessment_id!).eq("status", "enviada"),
  ]);
  const latest = ((latestRows ?? []) as Latest[])[0] ?? null;
  const done = m.done_steps.includes("avaliacao");
  const open = m.question_count - m.objective_count;
  const graded = m.pass_score != null;
  const base = stepHref(c.enrollmentId, m.module_id, "avaliacao");
  const exhausted = graded && m.max_attempts != null && (used ?? 0) >= m.max_attempts;

  return (
    <StepPage>
      <ModuleHeader m={m} />
      <section className="flex max-w-3xl flex-col gap-5 rounded-2xl border border-line bg-white p-6 sm:p-9" data-testid="assessment-intro">
        <h2 className="text-[22px] font-extrabold text-navy">{m.pass_score ? "Avaliação final" : `Avaliação do Módulo ${mm(m.position)}`}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            big={String(m.objective_count || m.question_count)}
            small={m.objective_count ? `${m.objective_count === 1 ? "questão objetiva" : "questões objetivas"}${open ? ` e ${open} ${open === 1 ? "atividade aberta" : "atividades abertas"}` : ""}` : "atividades abertas"}
          />
          <Stat big={m.time_limit_minutes ? `${m.time_limit_minutes} min` : "Livre"} small={m.time_limit_minutes ? "tempo de prova" : "sem cronômetro"} />
          {graded ? <Stat big={`${m.pass_score} de ${m.objective_count}`} small="acertos para aprovação" /> : <Stat big="Sem nota" small="obrigatória para concluir" />}
        </div>
        <p className="max-w-[68ch] text-sm leading-relaxed text-ink/80">
          Leia cada enunciado e escolha uma única alternativa.
          {open ? " Nas atividades abertas, escreva seu raciocínio sem usar dados reais de pessoas ou empresas." : ""}
          {m.time_limit_minutes ? " O cronômetro começa ao iniciar e, se o tempo acabar, a avaliação é enviada com o que estiver respondido." : ""} As respostas são
          salvas automaticamente.{" "}
          {graded
            ? "O retorno comentado de cada questão aparece depois da aprovação ou quando acabarem as tentativas."
            : "Depois do envio você vê o retorno comentado de cada questão."}
        </p>
        {graded && (
          <p className="text-sm text-muted">
            Tentativas: {used ?? 0} {m.max_attempts ? `de ${m.max_attempts}` : "(sem limite)"}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {done ? (
            <>
              {latest && (
                <Link href={`${base}/resultado/${latest.id}`} className="inline-flex min-h-12 items-center rounded-[10px] border border-line px-5 text-[15px] font-bold text-navy hover:bg-surface">
                  Ver resultado
                </Link>
              )}
              <Link href={nextAfter(c, m, "avaliacao")} className="inline-flex min-h-12 items-center rounded-[10px] bg-navy px-5 text-[15px] font-bold text-white hover:bg-navy-700">
                Continuar o curso
              </Link>
            </>
          ) : latest?.status === "em_andamento" ? (
            <StepButton tone="green" action={startAttemptAction.bind(null, c.enrollmentId, m.module_id)} testId="start-quiz">
              Continuar avaliação
            </StepButton>
          ) : (
            <>
              {latest && (
                <Link href={`${base}/resultado/${latest.id}`} className="inline-flex min-h-12 items-center rounded-[10px] border border-line px-5 text-[15px] font-bold text-navy hover:bg-surface">
                  Ver o último resultado
                </Link>
              )}
              {c.canStudy && !exhausted && (
                <StepButton tone="green" action={startAttemptAction.bind(null, c.enrollmentId, m.module_id)} testId="start-quiz">
                  {latest ? "Fazer nova tentativa" : "Iniciar avaliação"}
                </StepButton>
              )}
              {exhausted && <p className="text-sm text-danger">Você usou todas as tentativas. Fale com a AUDITA para orientação.</p>}
            </>
          )}
        </div>
      </section>
    </StepPage>
  );
}
