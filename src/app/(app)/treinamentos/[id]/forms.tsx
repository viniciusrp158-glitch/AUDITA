"use client";

import { ArrowDown, ArrowUp, ExternalLink, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { withBase } from "@/lib/base-path";
import { formatBytes } from "@/lib/library/labels";
import { acceptFor, FILE_KINDS, MAX_FILE_BYTES, TRAINING_BUCKET, type FileKind } from "@/lib/training/labels";
import { uploadToSignedUrl } from "@/lib/supabase/browser-upload";
import {
  moveModuleAction,
  prepareTrainingUploadAction,
  registerTrainingFileAction,
  removeFileAction,
  setModuleStatusAction,
  type TrState,
} from "../actions";

type Action = (s: TrState, f: FormData) => Promise<TrState>;

function useAction(action: Action) {
  return useActionState<TrState, FormData>(action, {});
}

function Feedback({ state }: { state: TrState }) {
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.ok) return <Alert kind="info">{state.ok}</Alert>;
  return null;
}

// ---------------------------------------------------------------------------
// Ficha técnica
// ---------------------------------------------------------------------------
export type FichaValues = Record<string, string | null>;

export function FichaForm({ action, initial, readOnly }: { action: Action; initial: FichaValues; readOnly: boolean }) {
  const [state, formAction] = useAction(action);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? (Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, x ?? ""])) as Record<string, string>);
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="ficha-form">
      <Feedback state={state} />
      <fieldset disabled={readOnly} className="space-y-4">
        <Field label="Título do curso" name="title" defaultValue={v.title} error={e.title} maxLength={200} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carga horária (minutos)" name="workload_minutes" required={false} inputMode="numeric" defaultValue={v.workload_minutes} error={e.workload_minutes} hint="Ex.: 240 para 4 h." />
          <Field label="Instrutor / responsável técnico" name="instructor_name" required={false} defaultValue={v.instructor_name} error={e.instructor_name} maxLength={200} />
        </div>
        <Field label="Modalidade" name="modality" required={false} defaultValue={v.modality} error={e.modality} maxLength={300} hint="Ex.: 100% EAD, assíncrono; curso livre introdutório." />
        <TextAreaField label="Resumo (aparece na página de venda)" name="summary" rows={2} maxLength={1000} defaultValue={v.summary} error={e.summary} />
        <TextAreaField label="Objetivo geral" name="general_objective" rows={3} maxLength={2000} defaultValue={v.general_objective} error={e.general_objective} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextAreaField label="Público-alvo" name="audience" rows={3} maxLength={2000} defaultValue={v.audience} error={e.audience} />
          <TextAreaField label="Pré-requisitos" name="prerequisites" rows={3} maxLength={2000} defaultValue={v.prerequisites} error={e.prerequisites} />
        </div>
        <TextAreaField label="Metodologia" name="methodology" rows={3} maxLength={4000} defaultValue={v.methodology} error={e.methodology} />
        <TextAreaField label="Avaliação e certificação" name="assessment_rules" rows={3} maxLength={4000} defaultValue={v.assessment_rules} error={e.assessment_rules} hint="Ex.: avaliação final com 10 questões; aprovação com 7 acertos." />
        <div className="grid gap-4 md:grid-cols-2">
          <TextAreaField label="Recursos e apoio" name="resources" rows={3} maxLength={2000} defaultValue={v.resources} error={e.resources} />
          <TextAreaField label="Referências" name="references_text" rows={3} maxLength={4000} defaultValue={v.references_text} error={e.references_text} />
        </div>
        <TextAreaField label="Aviso importante (limites do curso)" name="important_notice" rows={2} maxLength={2000} defaultValue={v.important_notice} error={e.important_notice} />
        {!readOnly && (
          <div className="sm:max-w-xs">
            <SubmitButton pendingText="Salvando…">Salvar ficha técnica</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Venda (preço, prazo, situação)
// ---------------------------------------------------------------------------
export function CommercialForm({ action, initial }: { action: Action; initial: Record<string, string> }) {
  const [state, formAction] = useAction(action);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? initial;
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="commercial-form">
      <Feedback state={state} />
      <Field label="Título do treinamento (lista e cadastro)" name="title" defaultValue={v.title} error={e.title} maxLength={200} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Preço (R$)" name="price" required={false} defaultValue={v.price} error={e.price} hint="Vazio = PENDENTE (não vai à venda)." inputMode="decimal" />
        <Field label="Prazo de acesso (dias)" name="access_days" required={false} defaultValue={v.access_days} error={e.access_days} inputMode="numeric" hint="Vazio = a definir." />
        <SelectField
          label="Situação"
          name="status"
          defaultValue={v.status}
          options={[
            { value: "ativo", label: "Ativo" },
            { value: "inativo", label: "Inativo" },
          ]}
        />
      </div>
      <TextAreaField label="Observações internas" name="notes" rows={2} maxLength={2000} defaultValue={v.notes} error={e.notes} />
      <p className="text-xs text-muted">Preço e prazo valem para o treinamento (todas as versões) e podem ser ajustados a qualquer momento. A venda pública entra numa etapa seguinte.</p>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------
export function AddModuleForm({ action }: { action: Action }) {
  const [state, formAction] = useAction(action);
  return (
    <form action={formAction} noValidate className="flex flex-wrap items-end gap-3" data-testid="add-module-form">
      <div className="min-w-0 flex-1 basis-72">
        <Field label="Novo módulo" name="title" required={false} defaultValue={state.ok ? "" : state.values?.title} error={state.fieldErrors?.title} placeholder="Ex.: Fundamentos de segurança e saúde no trabalho" maxLength={200} />
      </div>
      <div className="w-full sm:w-auto">
        <SubmitButton pendingText="Incluindo…" full={false}>
          Incluir módulo
        </SubmitButton>
      </div>
      {(state.error || state.ok) && (
        <div className="w-full">
          <Feedback state={state} />
        </div>
      )}
    </form>
  );
}

export function ModuleForm({ action, initial, readOnly }: { action: Action; initial: Record<string, string>; readOnly: boolean }) {
  const [state, formAction] = useAction(action);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? initial;
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="module-form">
      <Feedback state={state} />
      <fieldset disabled={readOnly} className="space-y-4">
        <Field label="Título do módulo" name="title" defaultValue={v.title} error={e.title} maxLength={200} />
        <TextAreaField label="Objetivo" name="objective" rows={2} maxLength={2000} defaultValue={v.objective} error={e.objective} />
        <TextAreaField label="Conteúdo (tópicos)" name="content_summary" rows={3} maxLength={4000} defaultValue={v.content_summary} error={e.content_summary} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Videoaula (min)" name="video_minutes" required={false} inputMode="numeric" defaultValue={v.video_minutes} error={e.video_minutes} />
          <Field label="Leitura (min)" name="reading_minutes" required={false} inputMode="numeric" defaultValue={v.reading_minutes} error={e.reading_minutes} />
          <Field label="Atividades (min)" name="activity_minutes" required={false} inputMode="numeric" defaultValue={v.activity_minutes} error={e.activity_minutes} />
        </div>
        <Field
          label="Link da videoaula no YouTube"
          name="video_url"
          type="url"
          required={false}
          defaultValue={v.video_url}
          error={e.video_url}
          placeholder="https://youtu.be/…"
          hint="Publique o vídeo como “não listado” no YouTube e cole o link aqui."
        />
        {!readOnly && (
          <div className="sm:max-w-xs">
            <SubmitButton pendingText="Salvando…">Salvar módulo</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}

export function ModuleControls({
  courseId,
  moduleId,
  canUp,
  canDown,
  status,
  isOrientation,
}: {
  courseId: string;
  moduleId: string;
  canUp: boolean;
  canDown: boolean;
  status: "ativo" | "inativo";
  isOrientation: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }
  const btn = "inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-navy/40 disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isOrientation && (
        <>
          <button type="button" className={btn} disabled={pending || !canUp} onClick={() => run(() => moveModuleAction(courseId, moduleId, -1))} aria-label="Mover para cima">
            <ArrowUp size={14} /> Subir
          </button>
          <button type="button" className={btn} disabled={pending || !canDown} onClick={() => run(() => moveModuleAction(courseId, moduleId, 1))} aria-label="Mover para baixo">
            <ArrowDown size={14} /> Descer
          </button>
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => run(() => setModuleStatusAction(courseId, moduleId, status === "ativo" ? "inativo" : "ativo"))}
          >
            {status === "ativo" ? "Inativar módulo" : "Reativar módulo"}
          </button>
        </>
      )}
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------
export type SlotFile = { id: string; original_name: string; size_bytes: number; position: number };

/** Um tipo de material: lista os arquivos ativos e permite enviar (troca o anterior, ou acrescenta imagens de slides). */
export function FileSlot({
  courseId,
  versionId,
  moduleId,
  kind,
  files,
  readOnly,
  testId,
}: {
  courseId: string;
  versionId: string;
  moduleId: string | null;
  kind: FileKind;
  files: SlotFile[];
  readOnly: boolean;
  testId?: string;
}) {
  const info = FILE_KINDS[kind];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const inputId = `file-${moduleId ?? "curso"}-${kind}`;

  function onPick(ev: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    if (!picked.length) return;
    setError(null);
    const list = info.multiple ? picked.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })) : picked.slice(0, 1);
    for (const f of list) {
      const ext = (/\.([A-Za-z0-9]+)$/.exec(f.name)?.[1] ?? "").toLowerCase();
      if (!info.accept.includes(ext)) {
        setError(`${f.name}: envie ${info.accept.map((e) => e.toUpperCase()).join(" ou ")}.`);
        return;
      }
      if (f.size === 0 || f.size > MAX_FILE_BYTES) {
        setError(`${f.name}: arquivo vazio ou maior que 50 MB.`);
        return;
      }
    }
    start(async () => {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const prefix = list.length > 1 ? `(${i + 1}/${list.length}) ` : "";
        setStep(`${prefix}Preparando ${f.name}…`);
        const prep = await prepareTrainingUploadAction(courseId, versionId, { kind, moduleId, fileName: f.name, size: f.size });
        if (prep.error || !prep.path || !prep.token) {
          setError(prep.error ?? "Não foi possível preparar o envio.");
          break;
        }
        setStep(`${prefix}Enviando ${f.name} (${formatBytes(f.size)})…`);
        const up = await uploadToSignedUrl(TRAINING_BUCKET, prep.path, prep.token, f);
        if (up.error) {
          setError(`O envio de ${f.name} falhou. Tente novamente.`);
          break;
        }
        setStep(`${prefix}Conferindo ${f.name}…`);
        const reg = await registerTrainingFileAction(courseId, versionId, { kind, moduleId, path: prep.path, fileName: f.name });
        if (reg.error) {
          setError(reg.error);
          break;
        }
      }
      setStep("");
      router.refresh();
    });
  }

  function onRemove(fileId: string) {
    setError(null);
    start(async () => {
      const r = await removeFileAction(courseId, fileId);
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  const visible = info.multiple && !showAll ? files.slice(0, 4) : files;
  const Icon = info.multiple ? ImageIcon : FileText;
  return (
    <div className="flex flex-col gap-2" data-testid={testId ?? `slot-${kind}`}>
      {files.length === 0 ? (
        <p className="text-sm text-warn">{info.multiple ? "Nenhuma imagem enviada." : "Pendente"}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              <Icon size={15} className="shrink-0 text-muted" aria-hidden />
              <a href={withBase(`/treinamentos/arquivo/${f.id}`)} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-medium text-ink hover:text-navy hover:underline">
                {f.original_name}
              </a>
              <span className="shrink-0 text-xs text-muted">{formatBytes(f.size_bytes)}</span>
              {!readOnly && (
                <button type="button" onClick={() => onRemove(f.id)} disabled={pending} className="shrink-0 rounded p-1 text-muted hover:text-danger" aria-label={`Remover ${f.original_name}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
          {info.multiple && files.length > 4 && (
            <li>
              <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-semibold text-navy hover:underline">
                {showAll ? "Mostrar menos" : `Ver todas as ${files.length} imagens`}
              </button>
            </li>
          )}
        </ul>
      )}
      {!readOnly && (
        <div>
          <input ref={inputRef} id={inputId} type="file" accept={acceptFor(kind)} multiple={info.multiple} onChange={onPick} className="sr-only" aria-label={`Enviar ${info.label}`} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-navy/40 disabled:cursor-wait disabled:opacity-70"
          >
            <Upload size={14} />
            {pending ? step || "Enviando…" : files.length && !info.multiple ? "Substituir" : info.multiple ? "Enviar imagens" : "Enviar arquivo"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function VideoLink({ url }: { url: string | null }) {
  if (!url) return <p className="text-sm text-warn">Link pendente</p>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:underline">
      Abrir no YouTube <ExternalLink size={13} />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Versões
// ---------------------------------------------------------------------------
export function PublishForm({ action }: { action: Action }) {
  const [state, formAction] = useAction(action);
  return (
    <form action={formAction} noValidate className="space-y-3" data-testid="publish-form">
      <Feedback state={state} />
      <CheckboxField name="confirm" label="Revisei a ficha técnica, os módulos e os materiais desta versão." hint="Depois de publicada, a versão fica congelada; ajustes viram uma nova versão." />
      {state.fieldErrors?.confirm && <p className="text-xs text-danger">{state.fieldErrors.confirm}</p>}
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Publicando…">Publicar versão</SubmitButton>
      </div>
    </form>
  );
}

export function CancelVersionForm({ action }: { action: Action }) {
  const [state, formAction] = useAction(action);
  return (
    <form action={formAction} noValidate className="space-y-3">
      <Feedback state={state} />
      <Field label="Motivo do cancelamento" name="reason" error={state.fieldErrors?.reason} hint="O registro e os arquivos continuam no histórico." />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Cancelando…" variant="danger">
          Cancelar rascunho
        </SubmitButton>
      </div>
    </form>
  );
}

export function NewVersionForm({ action, suggestion }: { action: Action; suggestion: string }) {
  const [state, formAction] = useAction(action);
  return (
    <form action={formAction} noValidate className="flex flex-wrap items-end gap-3">
      <div className="w-40">
        <Field label="Nova versão" name="version_label" defaultValue={state.values?.version_label ?? suggestion} error={state.fieldErrors?.version_label} />
      </div>
      <div className="w-full sm:w-auto">
        <SubmitButton pendingText="Criando…" full={false}>
          Criar nova versão
        </SubmitButton>
      </div>
      {state.error && (
        <div className="w-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
