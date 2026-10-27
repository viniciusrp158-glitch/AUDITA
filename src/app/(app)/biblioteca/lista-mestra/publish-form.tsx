"use client";

import { useActionState } from "react";
import { Alert, CheckboxField, Field, SubmitButton } from "@/components/form";
import { publishMasterListAction, type MasterState } from "./actions";

export function PublishMasterListForm({ revision, defaultName }: { revision: string; defaultName: string }) {
  const [state, action] = useActionState<MasterState, FormData>(publishMasterListAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Aprovado por" name="approved_by" defaultValue={defaultName} error={e.approved_by} maxLength={200} />
      <CheckboxField
        name="confirm"
        label={`Conferi o conteúdo acima e aprovo a ${revision} como vigente.`}
        hint="A revisão anterior fica preservada como substituída (AUDDOC001 / CA-09)."
      />
      {e.confirm && <p className="text-xs text-danger">{e.confirm}</p>}
      <div className="sm:w-72">
        <SubmitButton pendingText="Gerando e publicando…">Aprovar e publicar a {revision}</SubmitButton>
      </div>
    </form>
  );
}
