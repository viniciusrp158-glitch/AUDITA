"use client";

import { useActionState } from "react";
import { Alert, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import type { TrState } from "../actions";
import { sendNoticeAction } from "./actions";
import { DESTINOS } from "./destinos";

/** Formulário do comunicado. Depois de enviar, o formulário volta vazio (chave muda com o envio). */
export function NoticeForm({ courses }: { courses: { id: string; label: string }[] }) {
  const [state, action] = useActionState<TrState, FormData>(sendNoticeAction, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  return (
    <form key={state.seq ?? 0} action={action} className="flex flex-col gap-4" data-testid="notice-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <Field label="Título" name="title" maxLength={140} defaultValue={v.title} error={fe.title} hint="Aparece em destaque na lista de avisos do aluno." />
      <TextAreaField label="Texto" name="body" rows={4} maxLength={2000} defaultValue={v.body} error={fe.body} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Para quem"
          name="course_id"
          defaultValue={v.course_id ?? ""}
          error={fe.course_id}
          options={[{ value: "", label: "Todos os alunos" }, ...courses.map((c) => ({ value: c.id, label: `Alunos de ${c.label}` }))]}
        />
        <SelectField label="Ao tocar, abrir" name="link" defaultValue={v.link ?? ""} error={fe.link} options={DESTINOS} />
      </div>
      <div>
        <SubmitButton pendingText="Enviando…" full={false}>
          Enviar comunicado
        </SubmitButton>
      </div>
    </form>
  );
}
