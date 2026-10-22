"use client";

import { Check, FileSearch, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import type { ParsedQuestion } from "@/lib/training/gabarito";
import { importGabaritosAction, readGabaritosAction, updateQuestionAction, type GabaritoReading } from "../avaliacoes-actions";
import type { TrState } from "../actions";

type Action = (s: TrState, f: FormData) => Promise<TrState>;
type Question = ParsedQuestion & { id?: string; status?: "ativo" | "inativo" };

const mcode = (p: number) => `M${String(p).padStart(2, "0")}`;

function Feedback({ state }: { state: TrState }) {
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.ok) return <Alert kind="info">{state.ok}</Alert>;
  return null;
}

/** Enunciado, alternativas (com a certa marcada) e retorno, como o aluno verá depois do envio. */
export function QuestionView({ q }: { q: Question }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium leading-relaxed text-ink">{q.statement}</p>
      {q.options && (
        <ul className="flex flex-col gap-1">
          {q.options.map((o) => {
            const right = o.key === q.correct_key;
            return (
              <li key={o.key} className={`flex gap-2 rounded-md px-2 py-1 text-sm ${right ? "bg-ok/10 font-semibold text-ok" : "text-ink"}`}>
                <span className="w-4 shrink-0 font-bold">{o.key}</span>
                <span className="flex-1">{o.text}</span>
                {right && <Check size={16} aria-label="Resposta certa" className="shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
      {q.feedback && (
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-ink">
          <span className="font-semibold">{q.kind === "objetiva" ? "Retorno ao aluno: " : "Resposta de referência: "}</span>
          {q.feedback}
        </p>
      )}
    </div>
  );
}

function counts(qs: Question[]) {
  const o = qs.filter((q) => q.kind === "objetiva").length;
  const a = qs.length - o;
  return [o && `${o} ${o === 1 ? "objetiva" : "objetivas"}`, a && `${a} ${a === 1 ? "aberta" : "abertas"}`].filter(Boolean).join(" e ") || "nenhuma questão";
}

/**
 * Lê o "Gabarito comentado" (PDF já enviado no material do instrutor), mostra a conferência e grava as questões.
 * Com versionId lê todos os módulos ativos; com moduleId, só aquele módulo.
 */
export function GabaritoReader({ courseId, moduleId, versionId, label }: { courseId: string; moduleId?: string; versionId?: string; label: string }) {
  const router = useRouter();
  const [readings, setReadings] = useState<GabaritoReading[] | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const ready = (readings ?? []).filter((r) => r.questions.length);
  const total = ready.reduce((n, r) => n + r.questions.length, 0);
  const warnings = (readings ?? []).reduce((n, r) => n + r.warnings.length, 0);

  const read = () =>
    start(async () => {
      setMsg(null);
      const r = await readGabaritosAction(courseId, { moduleId, versionId });
      if (r.error) setMsg({ kind: "error", text: r.error });
      setReadings(r.readings ?? null);
    });
  const save = () =>
    start(async () => {
      const r = await importGabaritosAction(
        courseId,
        ready.map((x) => x.moduleId),
      );
      setMsg(r.error ? { kind: "error", text: r.error } : { kind: "info", text: r.ok ?? "" });
      if (!r.error) {
        setReadings(null);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3" data-testid="gabarito-reader">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={read}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-surface disabled:opacity-60"
        >
          <FileSearch size={16} aria-hidden /> {pending && !readings ? "Lendo…" : label}
        </button>
        {readings && (
          <span className="text-sm text-muted">
            {total} {total === 1 ? "questão encontrada" : "questões encontradas"}
            {warnings ? `, ${warnings} ${warnings === 1 ? "aviso" : "avisos"}` : ", sem avisos"}
          </span>
        )}
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {readings && (
        <div className="flex flex-col gap-3" data-testid="gabarito-conference">
          {readings.map((r) => (
            <section key={r.moduleId} className="rounded-lg border border-line">
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-2">
                <span className="text-sm font-bold text-navy">{mcode(r.position)}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{r.title}</span>
                <span className="text-xs text-muted">{r.fileName ?? "sem gabarito"} · {counts(r.questions)}</span>
              </header>
              {r.warnings.length > 0 && (
                <ul className="flex flex-col gap-1 border-b border-line px-3 py-2">
                  {r.warnings.map((w) => (
                    <li key={w} className="text-sm text-warn">
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              {r.questions.length > 0 && (
                <ol className="divide-y divide-line">
                  {r.questions.map((q) => (
                    <li key={q.code} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:gap-4">
                      <span className="shrink-0 text-xs font-bold text-muted sm:w-24">
                        {q.code}
                        <span className="block font-normal">{q.kind === "objetiva" ? `Objetiva · ${q.correct_key}` : "Aberta, sem nota"}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <QuestionView q={q} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
          {total > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
              >
                {pending ? "Gravando…" : `Gravar ${total} ${total === 1 ? "questão" : "questões"}`}
              </button>
              <span className="text-xs text-muted">Questões já gravadas com o mesmo código são atualizadas; as que saíram do gabarito ficam inativas.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Tempo de prova, tentativas, intervalo e nota mínima de uma avaliação. */
export function AssessmentRulesForm({ action, initial, readOnly, objectives }: { action: Action; initial: Record<string, string>; readOnly: boolean; objectives: number }) {
  const [state, formAction] = useActionState<TrState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? initial;
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="assessment-rules">
      <Feedback state={state} />
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tempo de prova (min)" name="time_limit_minutes" required={false} inputMode="numeric" defaultValue={v.time_limit_minutes} error={e.time_limit_minutes} hint="Vazio: sem cronômetro." />
          <Field
            label="Nota mínima (acertos)"
            name="pass_score"
            required={false}
            inputMode="numeric"
            defaultValue={v.pass_score}
            error={e.pass_score}
            hint={`Vazio: sem nota. ${objectives} ${objectives === 1 ? "objetiva" : "objetivas"}.`}
          />
          <Field label="Tentativas" name="max_attempts" required={false} inputMode="numeric" defaultValue={v.max_attempts} error={e.max_attempts} hint="Vazio: sem limite." />
          <Field label="Intervalo entre tentativas (h)" name="retry_wait_hours" required={false} inputMode="numeric" defaultValue={v.retry_wait_hours} error={e.retry_wait_hours} hint="0: sem espera." />
        </div>
        <CheckboxField name="shuffle_questions" label="Embaralhar a ordem das questões a cada tentativa" defaultChecked={v.shuffle_questions === "on"} />
        {!readOnly && (
          <div className="sm:max-w-xs">
            <SubmitButton pendingText="Salvando…">Salvar regras</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}

function QuestionEditForm({ action, q }: { action: Action; q: Question }) {
  const [state, formAction] = useActionState<TrState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={formAction} noValidate className="mt-3 space-y-3 border-t border-line pt-3">
      <Feedback state={state} />
      <TextAreaField label="Enunciado" name="statement" rows={3} maxLength={4000} defaultValue={v.statement ?? q.statement} error={e.statement} />
      {q.options?.map((o) => (
        <Field key={o.key} label={`Alternativa ${o.key}`} name={`option_${o.key}`} defaultValue={v[`option_${o.key}`] ?? o.text} error={e[`option_${o.key}`]} />
      ))}
      {q.options && (
        <SelectField
          label="Resposta certa"
          name="correct_key"
          required
          options={q.options.map((o) => ({ value: o.key, label: o.key }))}
          defaultValue={v.correct_key ?? q.correct_key}
          error={e.correct_key}
        />
      )}
      <TextAreaField
        label={q.kind === "objetiva" ? "Retorno ao aluno" : "Resposta de referência"}
        name="feedback"
        required={false}
        rows={3}
        maxLength={4000}
        defaultValue={v.feedback ?? q.feedback ?? ""}
        error={e.feedback}
        hint="Aparece para o aluno depois do envio."
      />
      <SelectField
        label="Situação"
        name="status"
        required
        options={[
          { value: "ativo", label: "Ativa" },
          { value: "inativo", label: "Inativa (fica fora da prova)" },
        ]}
        defaultValue={v.status ?? q.status ?? "ativo"}
      />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar questão</SubmitButton>
      </div>
    </form>
  );
}

/** Banco de questões do módulo; no rascunho cada questão pode ser editada. */
export function QuestionList({ courseId, questions, readOnly }: { courseId: string; questions: Question[]; readOnly: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!questions.length) return <p className="text-sm text-muted">Nenhuma questão gravada.</p>;
  return (
    <ol className="divide-y divide-line rounded-lg border border-line" data-testid="question-list">
      {questions.map((q) => (
        <li key={q.id ?? q.code} className={`px-3 py-3 ${q.status === "inativo" ? "opacity-60" : ""}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <span className="shrink-0 text-xs font-bold text-muted sm:w-24">
              {q.code}
              <span className="block font-normal">
                {q.status === "inativo" ? "Inativa" : q.kind === "objetiva" ? `Objetiva · ${q.correct_key}` : "Aberta, sem nota"}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <QuestionView q={q} />
            </div>
            {!readOnly && q.id && (
              <button
                type="button"
                onClick={() => setOpen(open === q.id ? null : q.id!)}
                className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-md border border-line px-2 text-xs font-semibold text-navy hover:bg-surface"
                aria-expanded={open === q.id}
              >
                <Pencil size={13} aria-hidden /> Editar
              </button>
            )}
          </div>
          {open === q.id && q.id && <QuestionEditForm action={updateQuestionAction.bind(null, courseId, q.id)} q={q} />}
        </li>
      ))}
    </ol>
  );
}
