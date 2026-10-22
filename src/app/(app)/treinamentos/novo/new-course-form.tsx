"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/form";
import { createCourseAction, type TrState } from "../actions";

export function NewCourseForm() {
  const [state, formAction] = useActionState<TrState, FormData>(createCourseAction, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="new-course-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Código" name="course_code" defaultValue={v.course_code} error={e.course_code} hint="Ex.: L01" maxLength={7} />
        <Field label="Versão do material" name="version_label" defaultValue={v.version_label ?? "1.0"} error={e.version_label} hint="Ex.: 1.2" maxLength={5} />
      </div>
      <Field label="Título" name="title" defaultValue={v.title} error={e.title} maxLength={200} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Cadastrando…">Cadastrar treinamento</SubmitButton>
      </div>
    </form>
  );
}
