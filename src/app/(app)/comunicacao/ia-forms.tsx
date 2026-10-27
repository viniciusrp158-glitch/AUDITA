"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { BRAND_KEYS, BRANDS, CHANNELS, TEMPLATE_KEYS, TEMPLATES } from "@/lib/comunicacao/labels";
import type { CommState } from "./actions";
import type { BriefingOptions } from "./comm-forms";
import { createPieceWithAiAction, removeArtAction } from "./ia-actions";

type Action = (s: CommState, f: FormData) => Promise<CommState>;

/** Anexos: até 3 imagens; a primeira pode virar a foto de fundo da arte. */
function ReferenceFields({ error }: { error?: string }) {
  const [names, setNames] = useState<string[]>([]);
  return (
    <fieldset className="space-y-2 rounded-md border border-line p-3" data-testid="ai-references">
      <legend className="px-1 text-sm font-medium text-ink">Imagens de referência (opcional, até 3)</legend>
      <input
        type="file"
        name="references"
        multiple
        accept="image/png,image/jpeg,image/webp"
        aria-label="Imagens de referência"
        onChange={(ev) => setNames([...(ev.target.files ?? [])].map((f) => f.name))}
        className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-navy"
      />
      {names.length > 0 && <p className="text-xs text-muted">{names.join(" · ")}</p>}
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="use_background" className="mt-1" />
        <span>
          Usar a <strong>primeira imagem como foto de fundo</strong> da arte (a IA desenha faixas, formas e textos por cima).
          <span className="block text-xs text-muted">
            Sem marcar, as imagens servem só de referência de estilo: a IA copia composição, cores e formas, em desenho vetorial. Use apenas
            imagens que a AUDITA pode usar (próprias ou licenciadas).
          </span>
        </span>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

const EXAMPLE =
  "Ex.: Propaganda de treinamento de NR-35 da AUDITA. Trabalhador com cinto paraquedista e capacete numa estrutura metálica, céu ao fundo. Título forte \"Trabalho em altura com segurança\" e chamada \"Solicite uma proposta para a sua equipe\".";

/** Nova peça descrevendo a arte: o Claude desenha no estilo da marca escolhida. */
export function NewAiPieceForm({ opts }: { opts: BriefingOptions }) {
  const [state, formAction] = useActionState<CommState, FormData>(createPieceWithAiAction, {});
  const v = state.values ?? { brand: "audita", template: "post_quadrado", channel: "instagram" };
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4" data-testid="new-ai-piece-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <TextAreaField
        label="Descreva a arte que você quer"
        name="instruction"
        required
        defaultValue={v.instruction}
        error={e.instruction}
        maxLength={2000}
        rows={5}
        hint={EXAMPLE}
      />
      <ReferenceFields error={e.references} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Marca" name="brand" required defaultValue={v.brand} error={e.brand} options={BRAND_KEYS.map((b) => ({ value: b, label: BRANDS[b].label }))} />
        <SelectField
          label="Formato"
          name="template"
          required
          defaultValue={v.template}
          error={e.template}
          options={TEMPLATE_KEYS.map((t) => ({ value: t, label: `${TEMPLATES[t].label} (${TEMPLATES[t].size})` }))}
        />
        <SelectField
          label="Canal"
          name="channel"
          required
          defaultValue={v.channel}
          error={e.channel}
          options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Serviço divulgado (opcional)"
          name="service_id"
          defaultValue={v.service_id}
          error={e.service_id}
          hint="A IA respeita o escopo e os limites do serviço no catálogo."
          options={[{ value: "", label: "Nenhum serviço específico" }, ...opts.services.map((s) => ({ value: s.id, label: `${s.service_code} — ${s.name}` }))]}
        />
        <SelectField
          label="Campanha (opcional)"
          name="campaign_id"
          defaultValue={v.campaign_id}
          error={e.campaign_id}
          options={[{ value: "", label: "Sem campanha" }, ...opts.campaigns.map((c) => ({ value: c.id, label: `${c.campaign_code} — ${c.name}` }))]}
        />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Enviando à IA…">Criar a arte com IA</SubmitButton>
      </div>
    </form>
  );
}

/** Pedido de criação ou ajuste da arte de uma peça em rascunho. */
export function ArtRequestForm({ action, hasArt }: { action: Action; hasArt: boolean }) {
  const [state, formAction] = useActionState<CommState, FormData>(action, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.seq, state.ok, router]);
  return (
    <form action={formAction} noValidate className="space-y-3" data-testid="art-request-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <TextAreaField
        key={state.seq ?? 0}
        label={hasArt ? "O que você quer mudar na arte?" : "Descreva a arte que você quer"}
        name="instruction"
        required
        defaultValue={state.ok ? "" : state.values?.instruction}
        error={state.fieldErrors?.instruction}
        maxLength={2000}
        rows={3}
        hint={hasArt ? "Ex.: troque o fundo para azul-marinho, aumente o título e tire o subtítulo." : EXAMPLE}
      />
      <ReferenceFields key={`r-${state.seq ?? 0}`} error={state.fieldErrors?.references} />
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Enviando à IA…">
          {hasArt ? "Ajustar a arte com IA" : "Gerar a arte com IA"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Enquanto a IA trabalha, a tela se atualiza sozinha a cada 5 segundos. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

export function RemoveArtButton({ pieceId }: { pieceId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await removeArtAction(pieceId);
            setMsg(r.error ?? null);
            router.refresh();
          })
        }
        className="text-xs text-muted underline hover:text-navy disabled:opacity-60"
      >
        Voltar ao layout padrão (sem a arte)
      </button>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </span>
  );
}
