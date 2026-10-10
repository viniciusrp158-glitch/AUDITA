"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Alert, CheckboxField, Field, SubmitButton, TextAreaField } from "@/components/form";
import { ACCEPT, extOf, formatBytes, LIBRARY_BUCKET, MAX_FILE_BYTES, MIME_BY_EXT } from "@/lib/library/labels";
import { uploadToSignedUrl } from "@/lib/supabase/browser-upload";
import { prepareUploadAction, registerRevisionAction, type LibState } from "../actions";

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";

/** Envio de nova revisão: arquivo vai direto ao bucket privado por link assinado; o servidor confere e registra. */
export function UploadRevisionForm({ documentId, nextRevision }: { documentId: string; nextRevision: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ok, setOk] = useState<string | null>(null);
  const [step, setStep] = useState("");

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    setError(null);
    setErrors({});
    setOk(null);
    if (!(file instanceof File) || file.size === 0) {
      setErrors({ file: "Selecione o arquivo." });
      return;
    }
    if (!MIME_BY_EXT[extOf(file.name)]) {
      setErrors({ file: "Tipo de arquivo não aceito (Word, Excel, PowerPoint, PDF ou imagem)." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrors({ file: "Arquivo maior que 50 MB." });
      return;
    }
    const meta = {
      revision: String(fd.get("revision") ?? ""),
      approved_by: String(fd.get("approved_by") ?? ""),
      approved_on: String(fd.get("approved_on") ?? ""),
      issued_on: String(fd.get("issued_on") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    start(async () => {
      setStep("Preparando o envio…");
      const prep = await prepareUploadAction(documentId, { ...meta, fileName: file.name, size: file.size });
      if (prep.error || !prep.path || !prep.token) {
        setError(prep.error ?? "Não foi possível preparar o envio.");
        setErrors(prep.fieldErrors ?? {});
        setStep("");
        return;
      }
      setStep(`Enviando ${file.name} (${formatBytes(file.size)})…`);
      const up = await uploadToSignedUrl(LIBRARY_BUCKET, prep.path, prep.token, file);
      if (up.error) {
        setError("O envio do arquivo falhou. Tente novamente.");
        setStep("");
        return;
      }
      setStep("Conferindo o arquivo (SHA-256) e registrando…");
      const reg = await registerRevisionAction(documentId, { ...meta, path: prep.path, fileName: file.name });
      setStep("");
      if (reg.error) {
        setError(reg.error);
        return;
      }
      form.reset();
      setOk(
        `${meta.revision} registrada como rascunho.` +
          (reg.duplicateOf ? ` Atenção: o arquivo é idêntico ao da ${reg.duplicateOf} (mesmo SHA-256).` : " Confira e publique quando estiver aprovada."),
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="upload-form">
      {error && <Alert kind="error">{error}</Alert>}
      {ok && <Alert kind="info">{ok}</Alert>}
      <label className="block" htmlFor="file">
        <span className="mb-1 block text-sm font-medium text-ink">
          Arquivo<span className="text-danger" aria-hidden> *</span>
        </span>
        <input id="file" name="file" type="file" accept={ACCEPT} className={inputCls} />
        <span className={`mt-1 block text-xs ${errors.file ? "text-danger" : "text-muted"}`}>
          {errors.file ?? "Word, Excel, PowerPoint, PDF ou imagem, até 50 MB. O arquivo anterior nunca é substituído."}
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Revisão" name="revision" defaultValue={nextRevision} error={errors.revision} hint="Ex.: Rev.01" />
        <Field label="Aprovado por" name="approved_by" required={false} defaultValue="" error={errors.approved_by} hint="Pode ser completado antes de publicar." />
        <Field label="Data de aprovação" name="approved_on" type="date" required={false} error={errors.approved_on} />
        <Field label="Data de emissão" name="issued_on" type="date" required={false} error={errors.issued_on} />
      </div>
      <TextAreaField label="Observações da revisão" name="notes" rows={2} maxLength={2000} error={errors.notes} />
      <div className="sm:max-w-xs">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? step || "Enviando…" : "Enviar revisão"}
        </button>
      </div>
    </form>
  );
}

type Action = (s: LibState, f: FormData) => Promise<LibState>;

export function PublishRevisionForm({ action, initial }: { action: Action; initial: { approved_by: string | null; approved_on: string | null; issued_on: string | null } }) {
  const [state, formAction] = useActionState<LibState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? { approved_by: initial.approved_by ?? "", approved_on: initial.approved_on ?? "", issued_on: initial.issued_on ?? "" };
  return (
    <form action={formAction} noValidate className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Aprovado por" name="approved_by" defaultValue={v.approved_by} error={e.approved_by} />
        <Field label="Data de aprovação" name="approved_on" type="date" defaultValue={v.approved_on} error={e.approved_on} />
        <Field label="Data de emissão" name="issued_on" type="date" required={false} defaultValue={v.issued_on} error={e.issued_on} />
      </div>
      <CheckboxField name="confirm" label="Confirmo que este arquivo é a versão aprovada (não é minuta)." hint="Ao publicar, ela passa a vigente e a anterior fica como substituída, ainda acessível." />
      {e.confirm && <p className="text-xs text-danger">{e.confirm}</p>}
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Publicando…">Publicar como vigente</SubmitButton>
      </div>
    </form>
  );
}

export function CancelRevisionForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<LibState, FormData>(action, {});
  return (
    <form action={formAction} noValidate className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Motivo do cancelamento" name="reason" error={state.fieldErrors?.reason} hint="O registro e o arquivo continuam no histórico." />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Cancelando…" variant="danger">
          Cancelar rascunho
        </SubmitButton>
      </div>
    </form>
  );
}
