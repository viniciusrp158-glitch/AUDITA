"use client";

import { ArrowLeft, ArrowRight, Timer } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveAnswerAction, submitAttemptAction } from "./actions";

export type QuizQuestion = {
  id: string;
  code: string;
  kind: "objetiva" | "aberta";
  statement: string;
  options: { key: string; text: string }[] | null;
  choice: string | null;
  answer_text: string | null;
};

type Save = "idle" | "saving" | "saved" | "error";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Prova: uma questão por vez, respostas salvas no servidor a cada escolha, cronômetro pelo relógio do servidor
 * (deadline e "agora" vêm da tentativa) e envio automático quando o tempo acaba.
 */
export function QuizRunner({
  enrollmentId,
  moduleId,
  attemptId,
  questions,
  deadlineAt,
  serverNow,
}: {
  enrollmentId: string;
  moduleId: string;
  attemptId: string;
  questions: QuizQuestion[];
  deadlineAt: string | null;
  serverNow: string;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { choice: string | null; text: string }>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, { choice: q.choice, text: q.answer_text ?? "" }])),
  );
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const skew = useRef(new Date(serverNow).getTime() - Date.now());
  const [left, setLeft] = useState<number | null>(deadlineAt ? (new Date(deadlineAt).getTime() - (Date.now() + skew.current)) / 1000 : null);
  const autoSent = useRef(false);
  const textTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const q = questions[i];

  const answered = (id: string, kind: QuizQuestion["kind"]) => (kind === "objetiva" ? Boolean(answers[id]?.choice) : (answers[id]?.text ?? "").trim().length >= 10);
  const answeredCount = questions.filter((x) => answered(x.id, x.kind)).length;

  const persist = useCallback(
    async (qid: string, choice: string | null, text: string | null) => {
      setSave("saving");
      const r = await saveAnswerAction(attemptId, qid, choice, text);
      if (r.error) {
        setSave("error");
        setError(r.error);
      } else {
        setSave("saved");
        setError(null);
      }
    },
    [attemptId],
  );

  const submit = useCallback(
    (auto = false) => {
      if (autoSent.current && auto) return;
      autoSent.current = auto || autoSent.current;
      clearTimeout(textTimer.current);
      startSubmit(async () => {
        // salva a resposta aberta em edição antes de enviar
        const cur = questions[i];
        if (cur.kind === "aberta") await saveAnswerAction(attemptId, cur.id, null, answers[cur.id]?.text ?? "");
        const r = await submitAttemptAction(enrollmentId, moduleId, attemptId);
        if (r?.error) setError(r.error);
      });
    },
    [answers, attemptId, enrollmentId, i, moduleId, questions],
  );

  useEffect(() => {
    if (!deadlineAt) return;
    const end = new Date(deadlineAt).getTime();
    const t = setInterval(() => {
      const s = (end - (Date.now() + skew.current)) / 1000;
      setLeft(s);
      if (s <= 0) submit(true);
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineAt, submit]);

  const pick = (key: string) => {
    setAnswers((a) => ({ ...a, [q.id]: { choice: key, text: "" } }));
    void persist(q.id, key, null);
  };
  const type = (text: string) => {
    setAnswers((a) => ({ ...a, [q.id]: { choice: null, text } }));
    setSave("idle");
    clearTimeout(textTimer.current);
    const qid = q.id;
    textTimer.current = setTimeout(() => void persist(qid, null, text), 900);
  };
  const go = (n: number) => {
    if (q.kind === "aberta") {
      clearTimeout(textTimer.current);
      void persist(q.id, null, answers[q.id]?.text ?? "");
    }
    setI(Math.max(0, Math.min(questions.length - 1, n)));
  };

  const low = left !== null && left < 60;
  const last = i === questions.length - 1;
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 sm:p-8" data-testid="quiz">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.08em] text-muted uppercase">
            {q.code} · Questão {i + 1} de {questions.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {questions.map((x, n) => (
              <button
                key={x.id}
                type="button"
                onClick={() => go(n)}
                aria-label={`Ir para a questão ${n + 1}${answered(x.id, x.kind) ? " (respondida)" : ""}`}
                aria-current={n === i ? "step" : undefined}
                className={`h-2 w-7 rounded-full ${n === i ? "bg-navy" : answered(x.id, x.kind) ? "bg-green" : "bg-line"}`}
              />
            ))}
          </div>
        </div>
        {left !== null && (
          <div
            className={`flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-base font-extrabold tabular-nums ${low ? "bg-late-50 text-late" : "bg-chip text-navy"}`}
            role="timer"
            aria-label={`Tempo restante ${fmt(left)}`}
            data-testid="quiz-timer"
          >
            <Timer size={18} aria-hidden /> {fmt(left)}
          </div>
        )}
      </div>

      <p className="text-[17px] leading-relaxed font-bold text-navy sm:text-[19px]">{q.statement}</p>

      {q.kind === "objetiva" && q.options ? (
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Alternativas">
          {q.options.map((o) => {
            const sel = answers[q.id]?.choice === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => pick(o.key)}
                disabled={submitting}
                className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-ink ${sel ? "border-2 border-navy bg-[#eef4fb]" : "border border-line bg-white hover:border-navy/40"}`}
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${sel ? "bg-navy text-white" : "bg-chip text-navy"}`}>{o.key}</span>
                <span className="flex-1 text-[15px] leading-snug">{o.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`r-${q.id}`} className="text-sm font-semibold text-ink">
            Sua resposta
          </label>
          <textarea
            id={`r-${q.id}`}
            rows={7}
            maxLength={4000}
            value={answers[q.id]?.text ?? ""}
            onChange={(e) => type(e.target.value)}
            onBlur={() => void persist(q.id, null, answers[q.id]?.text ?? "")}
            disabled={submitting}
            className="w-full rounded-xl border border-line px-4 py-3 text-[15px] leading-relaxed focus:border-navy focus:outline-none"
            placeholder="Escreva seu raciocínio (sem nomes reais de pessoas ou empresas)."
          />
          <p className="text-xs text-muted">Atividade sem nota. Escreva pelo menos 10 caracteres.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0 || submitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-line px-4 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-40"
        >
          <ArrowLeft size={16} aria-hidden /> Anterior
        </button>
        <p className="text-center text-[13px] text-muted" aria-live="polite">
          {answeredCount} de {questions.length} respondidas · {save === "saving" ? "salvando…" : save === "error" ? "não salvou" : "respostas salvas automaticamente"}
        </p>
        {last ? (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting}
            data-testid="submit-quiz"
            className="inline-flex h-11 items-center justify-center rounded-[10px] bg-green px-5 text-sm font-extrabold text-navy disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Enviar respostas"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(i + 1)}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-navy px-4 text-sm font-bold text-white hover:bg-navy-700"
          >
            Próxima <ArrowRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
