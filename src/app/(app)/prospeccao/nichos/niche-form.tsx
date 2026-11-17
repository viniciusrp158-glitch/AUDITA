"use client";

import { useActionState } from "react";
import { Alert, SubmitButton } from "@/components/form";
import { saveNicheAction, type NicheState } from "./actions";

const input = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";
const label = "block text-sm font-medium text-ink";

export function NicheForm({
  niche,
  services,
}: {
  niche?: { id: string; name: string; cnaePrefixes: string[]; serviceCodes: string[]; isEntry: boolean; status: string; notes: string | null };
  services: { code: string; name: string }[];
}) {
  const [state, action] = useActionState<NicheState, FormData>(saveNicheAction, {});
  const err = (k: string) => (state.fieldErrors?.[k] ? <span className="mt-1 block text-xs text-danger">{state.fieldErrors[k]}</span> : null);
  return (
    <form action={action} className="space-y-3">
      {niche && <input type="hidden" name="id" value={niche.id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Nome
          <input name="name" defaultValue={niche?.name ?? ""} required maxLength={120} className={`mt-1 ${input}`} />
          {err("name")}
        </label>
        <label className={label}>
          CNAE (início do código, separado por vírgula)
          <input name="prefixes" defaultValue={niche?.cnaePrefixes.join(", ") ?? ""} required placeholder="Ex.: 41, 42, 4930" className={`mt-1 font-mono ${input}`} />
          {err("prefixes")}
        </label>
      </div>
      <fieldset>
        <legend className={`${label} mb-1`}>Serviços liberados ligados ao nicho</legend>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-line p-2 sm:grid-cols-2">
          {services.map((s) => (
            <label key={s.code} className="flex items-start gap-2 text-xs text-ink">
              <input type="checkbox" name="services" value={s.code} defaultChecked={niche?.serviceCodes.includes(s.code)} className="mt-0.5 size-4" />
              <span>
                <strong className="font-mono">{s.code}</strong> {s.name}
              </span>
            </label>
          ))}
        </div>
        {err("services")}
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="is_entry" defaultChecked={niche?.isEntry} className="size-4" /> Nicho de entrada
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          Situação
          <select name="status" defaultValue={niche?.status ?? "ativo"} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm">
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
      </div>
      <label className={label}>
        Observações
        <textarea name="notes" defaultValue={niche?.notes ?? ""} rows={2} maxLength={1000} className={`mt-1 ${input}`} />
      </label>
      <SubmitButton pendingText="Salvando e recalculando regiões…" full={false}>
        {niche ? "Salvar nicho" : "Criar nicho"}
      </SubmitButton>
    </form>
  );
}
