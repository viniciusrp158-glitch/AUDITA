"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, CheckboxField, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { ORIGINS } from "@/lib/demands/labels";
import type { FormOptions } from "@/lib/demands/queries";
import { todaySaoPaulo } from "@/lib/format";
import { COMMERCIAL_STATUS } from "@/lib/services/labels";
import { loadClientLinksAction, type ClientLinks, type DemandActionState } from "./actions";

export type DemandFormValues = Partial<
  Record<
    | "client_id" | "unit_id" | "contact_id" | "service_id" | "origin" | "summary" | "description" | "location"
    | "received_on" | "due_on" | "viability_notes" | "notes",
    string | null
  > & { is_recurring: boolean; viability_checked: boolean }
>;

const selectCls =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";

export function DemandForm({
  action,
  options,
  initial,
  initialLinks,
  submitLabel,
  cancelHref,
  isDev,
}: {
  action: (s: DemandActionState, f: FormData) => Promise<DemandActionState>;
  options: FormOptions;
  initial?: DemandFormValues;
  initialLinks?: ClientLinks;
  submitLabel: string;
  cancelHref: string;
  isDev: boolean;
}) {
  const [state, formAction] = useActionState<DemandActionState, FormData>(action, {});
  const sv = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const val = (k: keyof DemandFormValues) => (state.values ? (sv[k] ?? "") : String(initial?.[k] ?? ""));
  const checked = (k: "is_recurring" | "viability_checked") => (state.values ? sv[k] === "on" : Boolean(initial?.[k]));

  const [clientId, setClientId] = useState<string>(val("client_id"));
  const [serviceId, setServiceId] = useState<string>(val("service_id"));
  const [links, setLinks] = useState<ClientLinks>(initialLinks ?? { units: [], contacts: [] });
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!clientId) {
      setLinks({ units: [], contacts: [] });
      return;
    }
    if (initialLinks && clientId === initial?.client_id) {
      setLinks(initialLinks);
      return;
    }
    startLoading(async () => setLinks(await loadClientLinksAction(clientId)));
  }, [clientId, initial?.client_id, initialLinks]);

  const service = options.services.find((s) => s.id === serviceId);
  const families = [...new Set(options.services.map((s) => s.family))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const released = service && service.commercial_status === "apto_comercialmente" && service.catalog_status === "ativo";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {isDev && (
        <Alert kind="warning">
          Ambiente de desenvolvimento: a demanda será marcada como <strong>TESTE</strong>. Use apenas dados fictícios.
        </Alert>
      )}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Identificação</legend>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            Cliente<span className="text-danger" aria-hidden> *</span>
          </span>
          <select
            name="client_id"
            value={clientId}
            onChange={(ev) => setClientId(ev.target.value)}
            aria-invalid={e.client_id ? true : undefined}
            className={`${selectCls} ${e.client_id ? "border-danger" : "border-line"}`}
          >
            <option value="">Selecione o cliente</option>
            {options.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.is_test ? " [TESTE]" : ""}
              </option>
            ))}
          </select>
          {e.client_id ? (
            <span className="mt-1 block text-xs text-danger">{e.client_id}</span>
          ) : (
            <span className="mt-1 block text-xs text-muted">
              Cliente ainda não cadastrado?{" "}
              <Link href="/clientes/novo" className="text-navy underline">
                Cadastre primeiro
              </Link>{" "}
              ou envie um link de cadastro.
            </span>
          )}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            key={`u-${clientId}-${links.units.length}`}
            label={loading ? "Unidade (carregando…)" : "Unidade / local"}
            name="unit_id"
            options={[{ value: "", label: clientId ? "Sede / não se aplica" : "Selecione o cliente primeiro" }, ...links.units.map((u) => ({ value: u.id, label: u.name }))]}
            defaultValue={val("unit_id")}
            error={e.unit_id}
          />
          <SelectField
            key={`c-${clientId}-${links.contacts.length}`}
            label={loading ? "Contato (carregando…)" : "Pessoa de contato"}
            name="contact_id"
            options={[{ value: "", label: clientId ? "Não informado" : "Selecione o cliente primeiro" }, ...links.contacts.map((c) => ({ value: c.id, label: c.label }))]}
            defaultValue={val("contact_id")}
            error={e.contact_id}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Origem"
            name="origin"
            required
            options={Object.entries(ORIGINS).map(([value, label]) => ({ value, label }))}
            defaultValue={val("origin") || "whatsapp"}
            error={e.origin}
          />
          <Field label="Recebida em" name="received_on" type="date" defaultValue={val("received_on") || todaySaoPaulo()} error={e.received_on} />
          <Field label="Prazo pretendido" name="due_on" type="date" required={false} defaultValue={val("due_on")} error={e.due_on} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Necessidade</legend>
        <Field label="Resumo da solicitação" name="summary" defaultValue={val("summary")} error={e.summary} maxLength={200} placeholder="Ex.: Treinamento NR-35 para 12 colaboradores" />
        <TextAreaField label="Descrição / escopo pretendido" name="description" defaultValue={val("description")} error={e.description} rows={4} maxLength={4000} />
        <Field label="Local de execução" name="location" required={false} defaultValue={val("location")} error={e.location} placeholder="Município, unidade ou remoto" />
        <CheckboxField
          name="is_recurring"
          label="Contrato recorrente"
          defaultChecked={checked("is_recurring")}
          hint="Visitas e contatos serão registrados nesta mesma demanda, sem novo cadastro (AUDDOC009)."
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy">Serviço e viabilidade</legend>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Serviço do catálogo</span>
          <select name="service_id" value={serviceId} onChange={(ev) => setServiceId(ev.target.value)} className={`${selectCls} border-line`}>
            <option value="">A definir na análise</option>
            {families.map((f) => (
              <optgroup key={f} label={f}>
                {options.services
                  .filter((s) => s.family === f)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} · {COMMERCIAL_STATUS[s.commercial_status].label}
                      {s.catalog_status === "inativo" ? " · inativo" : ""}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {service && !released && (
          <Alert kind="warning">
            Serviço <strong>{COMMERCIAL_STATUS[service.commercial_status].label.toLowerCase()}</strong>
            {service.catalog_status === "inativo" ? " e inativo no catálogo" : ""}: a demanda pode ser registrada e analisada, mas
            não gera proposta comercial final (AUDDOC004 / AUDDOC017 RF-17).
          </Alert>
        )}
        <CheckboxField
          name="viability_checked"
          label="AUDDOC004 consultada (viabilidade, competência e recursos)"
          defaultChecked={checked("viability_checked")}
        />
        <TextAreaField
          label="Decisão de viabilidade / condicionantes"
          name="viability_notes"
          defaultValue={val("viability_notes")}
          error={e.viability_notes}
          rows={2}
          maxLength={2000}
        />
      </fieldset>

      <TextAreaField label="Observações" name="notes" defaultValue={val("notes")} error={e.notes} rows={3} maxLength={4000} />

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <SubmitButton pendingText="Salvando…" full={false}>
          {submitLabel}
        </SubmitButton>
        <Link href={cancelHref} className="text-sm text-muted hover:text-navy">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
