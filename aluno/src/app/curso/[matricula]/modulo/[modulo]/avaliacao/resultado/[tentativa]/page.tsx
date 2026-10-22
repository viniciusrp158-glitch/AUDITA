import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { isUuid, mm, nextAfter, stepHref } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";
import { startAttemptAction } from "../../../../../../actions";
import { StepButton } from "../../../../../../step-button";
import { loadStep, StepPage } from "../../../shared";

export const metadata = { title: "Resultado da avaliação" };

type Item = {
  code: string;
  kind: "objetiva" | "aberta";
  statement: string;
  options: { key: string; text: string }[] | null;
  choice: string | null;
  answer_text: string | null;
  is_correct: boolean | null;
  correct_key: string | null;
  feedback: string | null;
};
type Result = {
  id: string;
  module_id: string;
  enrollment_id: string;
  attempt_number: number;
  score: number;
  max_score: number;
  passed: boolean;
  pass_score: number | null;
  by_timeout: boolean;
  attempts_used: number;
  max_attempts: number | null;
  can_retry: boolean;
  next_attempt_at: string | null;
  show_feedback: boolean;
  review_modules: string[];
  items: Item[];
};

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function ResultadoPage({ params }: { params: Promise<{ matricula: string; modulo: string; tentativa: string }> }) {
  const p = await params;
  const { c, m } = await loadStep(Promise.resolve(p), "avaliacao");
  if (!isUuid(p.tentativa)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_attempt_result", { p_attempt_id: p.tentativa });
  const r = data as Result | null;
  if (error || !r || r.module_id !== m.module_id || r.enrollment_id !== c.enrollmentId) notFound();
  const graded = r.pass_score != null;
  const nextModule = c.modules.find((x) => x.position > m.position);
  const courseDone = Boolean(c.certificateCode);
  const scoreText = r.max_score ? `Você acertou ${r.score} de ${r.max_score}.` : "";

  let title: string;
  let detail: string;
  if (!r.passed) {
    title = "Ainda não foi desta vez";
    const rev = r.review_modules ?? [];
    const revText = rev.length ? `Revise ${rev.length === 1 ? "o Módulo" : "os Módulos"} ${rev.length > 1 ? `${rev.slice(0, -1).join(", ")} e ${rev.at(-1)}` : rev[0]}` : "Revise os módulos anteriores";
    detail = `${scoreText} O mínimo para aprovação é ${r.pass_score}. ${revText}${r.can_retry ? " antes da nova tentativa" : ""}.`;
  } else if (courseDone && !nextModule) {
    title = "Parabéns, curso concluído!";
    detail = `${scoreText} Seu certificado já está disponível.`;
  } else {
    title = graded ? "Aprovado" : `Módulo ${mm(m.position)} concluído`;
    detail = `${scoreText}${graded ? "" : " Atividade obrigatória, sem nota."} Leia o retorno de cada questão abaixo.${nextModule ? ` O Módulo ${mm(nextModule.position)} já está liberado.` : ""}`;
  }

  return (
    <StepPage>
      <section
        className={`flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:gap-6 sm:px-7 ${r.passed ? "bg-navy text-white" : "border border-late/30 bg-late-50 text-ink"}`}
        data-testid="quiz-result"
      >
        <span className={`flex size-16 shrink-0 items-center justify-center rounded-full ${r.passed ? "bg-green text-navy" : "bg-late text-white"}`}>
          {r.passed ? <Check size={30} strokeWidth={3} aria-hidden /> : <X size={30} strokeWidth={3} aria-hidden />}
        </span>
        <div className="flex-1">
          <p className="text-xl font-extrabold">{title}</p>
          <p className={`mt-1 text-sm ${r.passed ? "text-white/80" : "text-ink/80"}`}>
            {detail}
            {r.by_timeout ? " O tempo terminou e a avaliação foi enviada com o que estava respondido." : ""}
          </p>
          {graded && (
            <p className={`mt-1 text-xs ${r.passed ? "text-white/70" : "text-muted"}`}>
              Tentativa {r.attempt_number}
              {r.max_attempts ? ` de ${r.max_attempts}` : ""}
              {!r.passed && r.next_attempt_at ? ` · nova tentativa a partir de ${when(r.next_attempt_at)}` : ""}
            </p>
          )}
        </div>
        {r.passed ? (
          courseDone && !nextModule ? (
            <Link href={`/curso/${c.enrollmentId}/certificado`} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold whitespace-nowrap text-navy">
              Ver certificado
            </Link>
          ) : (
            <Link href={nextAfter(c, m, "avaliacao")} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold whitespace-nowrap text-navy" data-testid="next-module">
              {nextModule ? `Ir para o Módulo ${mm(nextModule.position)}` : "Voltar ao curso"}
            </Link>
          )
        ) : (
          r.can_retry &&
          c.canStudy && (
            <StepButton tone="navy" action={startAttemptAction.bind(null, c.enrollmentId, m.module_id)} testId="retry-quiz">
              Fazer nova tentativa
            </StepButton>
          )
        )}
      </section>

      {!r.show_feedback && (
        <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">
          O retorno comentado de cada questão aparece depois da aprovação ou quando acabarem as tentativas.
        </p>
      )}

      <ol className="flex flex-col gap-3" data-testid="quiz-feedback">
        {r.items.map((it) => {
          const opt = (k: string | null) => it.options?.find((o) => o.key === k);
          return (
            <li key={it.code} className="flex gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
              {r.show_feedback && it.kind === "objetiva" && (
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-white ${it.is_correct ? "bg-green-dark" : "bg-late"}`}>
                  {it.is_correct ? <Check size={16} strokeWidth={3} aria-label="Certa" /> : <X size={16} strokeWidth={3} aria-label="Errada" />}
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-xs font-bold tracking-[0.06em] text-muted uppercase">
                  {it.code}
                  {it.kind === "objetiva"
                    ? ` · sua resposta: ${it.choice ?? "em branco"}${r.show_feedback ? ` · correta: ${it.correct_key}` : ""}`
                    : " · atividade aberta, sem nota"}
                </p>
                <p className="text-[15px] leading-snug font-semibold text-ink">{it.statement}</p>
                {it.kind === "objetiva" && it.choice && <p className="text-sm text-muted">Você marcou: {opt(it.choice)?.text}</p>}
                {it.kind === "aberta" && <p className="text-sm whitespace-pre-line text-muted">Sua resposta: {it.answer_text ?? "em branco"}</p>}
                {r.show_feedback && it.feedback && (
                  <p className="mt-1 rounded-[10px] bg-lime-50 px-3.5 py-3 text-sm leading-relaxed text-[#263619]">
                    <strong>{it.kind === "objetiva" ? "Retorno:" : "Resposta de referência:"}</strong> {it.feedback}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <Link href={stepHref(c.enrollmentId, m.module_id, "avaliacao")} className="self-start text-sm font-semibold text-navy hover:underline">
        Voltar à avaliação do módulo
      </Link>
    </StepPage>
  );
}
