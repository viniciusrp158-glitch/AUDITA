"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useMemo, useState, useTransition } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import {
  ASSET_VARIANTS,
  BRAND_KEYS,
  BRANDS,
  CHANNELS,
  lengthWarnings,
  REVIEW_CHECKLIST,
  TEMPLATE_KEYS,
  TEMPLATES,
  textWarnings,
  type Template,
} from "@/lib/comunicacao/labels";
import { uploadToSignedUrl } from "@/lib/supabase/browser-upload";
import { prepareBrandUploadAction, registerBrandVersionAction, type CommState } from "./actions";

type Action = (s: CommState, f: FormData) => Promise<CommState>;
type Option = { value: string; label: string };

const COMMERCIAL: Record<string, string> = {
  apto_comercialmente: "liberado",
  apto_tecnicamente: "não liberado comercialmente",
  nao_liberado: "não liberado",
  expansao_futura: "expansão futura",
};

export type BriefingOptions = {
  services: { id: string; service_code: string; name: string; commercial_status: string }[];
  campaigns: { id: string; campaign_code: string; name: string }[];
};

function BriefingFields({ values, e, opts }: { values: Record<string, string>; e: Record<string, string>; opts: BriefingOptions }) {
  const serviceOptions: Option[] = [
    { value: "", label: "Nenhum serviço específico" },
    ...opts.services.map((s) => ({ value: s.id, label: `${s.service_code} — ${s.name} (${COMMERCIAL[s.commercial_status] ?? s.commercial_status})` })),
  ];
  const svc = opts.services.find((s) => s.id === values.service_id);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Modelo"
        name="template"
        required
        defaultValue={values.template}
        error={e.template}
        hint={values.template ? `${TEMPLATES[values.template as Template]?.size} — ${TEMPLATES[values.template as Template]?.use}` : undefined}
        options={[{ value: "", label: "Escolha…" }, ...TEMPLATE_KEYS.map((t) => ({ value: t, label: `${TEMPLATES[t].label} (${TEMPLATES[t].size})` }))]}
      />
      <SelectField
        label="Marca"
        name="brand"
        required
        defaultValue={values.brand || "audita"}
        error={e.brand}
        hint="PRO e HUB aparecem como soluções AUDITA (AUDDOC003 §01)."
        options={BRAND_KEYS.map((b) => ({ value: b, label: BRANDS[b].label }))}
      />
      <Field label="Tema" name="theme" defaultValue={values.theme} error={e.theme} maxLength={160} className="sm:col-span-2" hint="Ex.: Integração de SST para novos colaboradores." />
      <TextAreaField label="Objetivo" name="objective" defaultValue={values.objective} error={e.objective} maxLength={500} rows={2} />
      <TextAreaField label="Público" name="audience" defaultValue={values.audience} error={e.audience} maxLength={300} rows={2} hint="Ex.: gestores de pequenas empresas da região." />
      <SelectField
        label="Canal"
        name="channel"
        required
        defaultValue={values.channel}
        error={e.channel}
        options={[{ value: "", label: "Escolha…" }, ...Object.entries(CHANNELS).map(([v, l]) => ({ value: v, label: l }))]}
      />
      <SelectField
        label="Campanha"
        name="campaign_id"
        defaultValue={values.campaign_id}
        error={e.campaign_id}
        options={[{ value: "", label: "Sem campanha" }, ...opts.campaigns.map((c) => ({ value: c.id, label: `${c.campaign_code} — ${c.name}` }))]}
      />
      <SelectField
        label="Serviço divulgado"
        name="service_id"
        defaultValue={values.service_id}
        error={e.service_id}
        className="sm:col-span-2"
        hint="Só serviços “Apto comercialmente” podem ser divulgados: a aprovação é bloqueada para os demais (AUDDOC004)."
        options={serviceOptions}
      />
      {svc && svc.commercial_status !== "apto_comercialmente" && (
        <div className="sm:col-span-2">
          <Alert kind="warning">
            {svc.service_code} não está liberado comercialmente: a peça não poderá ser aprovada enquanto citar este serviço.
          </Alert>
        </div>
      )}
    </div>
  );
}

export function NewPieceForm({ action, opts }: { action: Action; opts: BriefingOptions }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  const values = state.values ?? { brand: "audita" };
  return (
    <form action={formAction} noValidate className="space-y-5" data-testid="new-piece-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <BriefingFields values={values} e={state.fieldErrors ?? {}} opts={opts} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Criando…">Criar peça e escrever o texto</SubmitButton>
      </div>
    </form>
  );
}

export function PieceForm({ action, initial, opts }: { action: Action; initial: Record<string, string>; opts: BriefingOptions }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  const values = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  const [live, setLive] = useState<Record<string, string>>(values);
  const template = (live.template || "post_quadrado") as Template;
  const limits = TEMPLATES[template]?.limits ?? TEMPLATES.post_quadrado.limits;
  const warnings = useMemo(
    () => [...lengthWarnings(template, live), ...textWarnings(live.title, live.subtitle, live.body, live.cta, live.caption)],
    [live, template],
  );
  return (
    <form
      action={formAction}
      noValidate
      className="space-y-6"
      data-testid="piece-form"
      onChange={(ev) => {
        const fd = new FormData(ev.currentTarget);
        setLive(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
      }}
    >
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-navy">Texto da peça</legend>
        <Field label={`Título (até ${limits.title})`} name="title" required={false} defaultValue={values.title} error={e.title} maxLength={90} />
        <Field label={`Subtítulo (até ${limits.subtitle})`} name="subtitle" required={false} defaultValue={values.subtitle} error={e.subtitle} maxLength={160} />
        <TextAreaField label={`Texto (até ${limits.body})`} name="body" defaultValue={values.body} error={e.body} maxLength={700} rows={4} />
        <Field label={`Chamada / próximo passo (até ${limits.cta})`} name="cta" required={false} defaultValue={values.cta} error={e.cta} maxLength={60} hint="Ex.: Fale com a AUDITA." />
        <CheckboxField key={`sl-${state.seq ?? 0}`} name="show_slogan" label="Mostrar o slogan aprovado: “Gestão inteligente para ambientes mais seguros.”" defaultChecked={values.show_slogan === "on"} />
        <CheckboxField
          key={`ct-${state.seq ?? 0}`}
          name="show_contacts"
          label="Mostrar os contatos oficiais (site, e-mail e telefone dos dados institucionais)."
          hint="Somente os contatos publicados em Configurações → Dados institucionais; nada é digitado aqui (AUDDOC003 §11: sem contatos fictícios)."
          defaultChecked={values.show_contacts === "on"}
        />
        <TextAreaField
          label="Legenda da publicação (opcional)"
          name="caption"
          defaultValue={values.caption}
          error={e.caption}
          maxLength={2200}
          rows={4}
          hint="Texto que acompanha o post na rede social. Copiado manualmente após a aprovação — nada é publicado pelo sistema."
        />
      </fieldset>

      {warnings.length > 0 && (
        <Alert kind="warning">
          <span className="font-semibold">Atenção antes de enviar:</span>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-navy">Briefing (modelo, marca, tema, canal, serviço)</summary>
        <div className="border-t border-line p-3">
          <BriefingFields values={values} e={e} opts={opts} />
        </div>
      </details>

      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar e atualizar a prévia</SubmitButton>
      </div>
    </form>
  );
}

export function SubmitPieceForm({ action, disabled }: { action: (s: CommState) => Promise<CommState>; disabled?: string }) {
  const [state, formAction] = useActionState<CommState>(action, {});
  return (
    <form action={formAction} className="space-y-2">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {disabled ? (
        <p className="text-sm text-muted">{disabled}</p>
      ) : (
        <div className="sm:max-w-xs">
          <SubmitButton pendingText="Enviando…">Enviar para revisão</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function ReviewForm({ action, blockers }: { action: Action; blockers: string[] }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-4" data-testid="review-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {blockers.length > 0 && (
        <Alert kind="warning">
          <span className="font-semibold">A aprovação será recusada:</span>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          Devolva com a orientação ou resolva a pendência.
        </Alert>
      )}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-navy">Revisão de marca e texto (todos obrigatórios para aprovar)</legend>
        {REVIEW_CHECKLIST.map((c) => (
          <CheckboxField key={c.key} name={`check_${c.key}`} label={c.label} />
        ))}
      </fieldset>
      <TextAreaField label="Observação (obrigatória para devolver)" name="nota" error={state.fieldErrors?.nota} maxLength={1000} rows={2} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="decisao" value="aprovar" className="rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
          Aprovar e autorizar exportação
        </button>
        <button type="submit" name="decisao" value="devolver" className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-navy/40">
          Devolver para ajuste
        </button>
      </div>
    </form>
  );
}

export function ReasonForm({ action, label, button, danger }: { action: Action; label: string; button: string; danger?: boolean }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  const uid = useId(); // vários formulários de motivo na mesma página: ids únicos
  const err = state.fieldErrors?.motivo;
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <label className="block" htmlFor={`motivo-${uid}`}>
        <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
        <input id={`motivo-${uid}`} name="motivo" maxLength={500} className={`${inputCls} ${err ? "border-danger" : ""}`} aria-invalid={err ? true : undefined} />
        {err && <span className="mt-1 block text-xs text-danger">{err}</span>}
      </label>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Registrando…" variant={danger ? "danger" : "secondary"}>
          {button}
        </SubmitButton>
      </div>
    </form>
  );
}

export function CampaignForm({ action, initial, button }: { action: Action; initial: Record<string, string>; button: string }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  const values = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="campaign-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da campanha" name="name" defaultValue={values.name} error={e.name} maxLength={160} className="sm:col-span-2" />
        <TextAreaField label="Objetivo" name="objective" defaultValue={values.objective} error={e.objective} maxLength={1000} rows={2} />
        <TextAreaField label="Público" name="audience" defaultValue={values.audience} error={e.audience} maxLength={300} rows={2} />
        <Field label="Início" name="starts_on" type="date" required={false} defaultValue={values.starts_on} error={e.starts_on} />
        <Field label="Fim" name="ends_on" type="date" required={false} defaultValue={values.ends_on} error={e.ends_on} />
        <SelectField
          label="Situação"
          name="status"
          defaultValue={values.status || "planejada"}
          error={e.status}
          options={[
            { value: "planejada", label: "Planejada" },
            { value: "ativa", label: "Ativa" },
            { value: "encerrada", label: "Encerrada" },
            { value: "cancelada", label: "Cancelada" },
          ]}
        />
        <TextAreaField label="Observações" name="notes" defaultValue={values.notes} error={e.notes} maxLength={2000} rows={2} />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">{button}</SubmitButton>
      </div>
    </form>
  );
}

export function AssetForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  const values = state.values ?? { brand: "audita", variant: "original_png" };
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="asset-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Marca" name="brand" required defaultValue={values.brand} error={e.brand} options={BRAND_KEYS.map((b) => ({ value: b, label: BRANDS[b].label }))} />
        <SelectField
          label="Tipo"
          name="variant"
          required
          defaultValue={values.variant}
          error={e.variant}
          options={Object.entries(ASSET_VARIANTS).map(([v, d]) => ({ value: v, label: d.label }))}
        />
        <Field label="Nome do ativo" name="title" defaultValue={values.title} error={e.title} maxLength={160} className="sm:col-span-2" hint="Ex.: Logo AUDITA — horizontal." />
        <TextAreaField label="Observações" name="notes" defaultValue={values.notes} error={e.notes} maxLength={2000} rows={2} className="sm:col-span-2" />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Cadastrando…">Cadastrar ativo</SubmitButton>
      </div>
    </form>
  );
}

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";

/** Envio de arquivo de marca: vai direto ao bucket privado por link assinado; o servidor confere tipo, SHA-256 e dimensões. */
export function BrandUploadForm({ assetId, accept }: { assetId: string; accept: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState("");
  const [ok, setOk] = useState("");
  return (
    <form
      className="space-y-3"
      data-testid="brand-upload"
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const fd = new FormData(form);
        const file = fd.get("file") as File | null;
        const source_note = String(fd.get("source_note") ?? "");
        setError("");
        setErrors({});
        setOk("");
        if (!file || !file.size) {
          setErrors({ file: "Escolha o arquivo." });
          return;
        }
        start(async () => {
          setStep("Preparando o envio…");
          const prep = await prepareBrandUploadAction(assetId, { fileName: file.name, size: file.size, source_note });
          if (prep.error || !prep.path || !prep.token) {
            setError(prep.error ?? "Não foi possível preparar o envio.");
            setErrors(prep.fieldErrors ?? {});
            setStep("");
            return;
          }
          setStep(`Enviando ${file.name}…`);
          const up = await uploadToSignedUrl("audita-marca", prep.path, prep.token, file);
          if (up.error) {
            setError("O envio do arquivo falhou. Tente novamente.");
            setStep("");
            return;
          }
          setStep("Conferindo o arquivo (SHA-256) e registrando…");
          const reg = await registerBrandVersionAction(assetId, { path: prep.path, fileName: file.name, source_note });
          setStep("");
          if (reg.error) {
            setError(reg.error);
            return;
          }
          form.reset();
          setOk(
            reg.duplicateOf
              ? `Versão registrada. Atenção: o arquivo é idêntico à versão ${reg.duplicateOf}.`
              : "Versão registrada como “aguardando aprovação”. Confira e aprove abaixo.",
          );
          router.refresh();
        });
      }}
    >
      {error && <Alert kind="error">{error}</Alert>}
      {ok && <Alert kind="info">{ok}</Alert>}
      <label className="block text-sm font-medium text-ink" htmlFor="brand-file">
        Arquivo
        <input id="brand-file" name="file" type="file" accept={accept} className={`${inputCls} mt-1`} />
        {errors.file && <span className="mt-1 block text-xs text-danger">{errors.file}</span>}
      </label>
      <Field
        label="Origem do arquivo"
        name="source_note"
        error={errors.source_note}
        maxLength={500}
        hint="Ex.: PNG oficial fornecido pela AUDITA (AUDDOC003 §02), sem alteração."
      />
      {step && <p className="text-sm text-muted">{step}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-70">
        {pending ? "Enviando…" : "Enviar nova versão"}
      </button>
    </form>
  );
}

export function ApproveBrandForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <CheckboxField
        name="confirm"
        label="Conferi com o arquivo oficial: nenhum elemento do desenho, das letras ou das cores foi alterado (AUDDOC003 §02 e §12)."
      />
      {state.fieldErrors?.confirm && <p className="text-xs text-danger">{state.fieldErrors.confirm}</p>}
      <Field label="Observação (opcional)" name="nota" required={false} maxLength={500} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Aprovando…">Aprovar versão</SubmitButton>
      </div>
    </form>
  );
}
