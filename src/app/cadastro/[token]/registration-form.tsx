"use client";

import { CheckCircle2, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, Field, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { UFS } from "@/lib/br";
import { MAX_CONTACTS, MAX_UNITS } from "@/lib/clients/limits";
import { submitRegistrationAction, type PublicFormState } from "./actions";

const UF_OPTIONS = [{ value: "", label: "Selecione" }, ...UFS.map((u) => ({ value: u, label: u }))];

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-navy">
        {n}. {title}
      </h2>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function RegistrationForm({
  token,
  termsVersion,
  termsTitle,
  termsBody,
}: {
  token: string;
  termsVersion: string;
  termsTitle: string;
  termsBody: string;
}) {
  const [state, formAction] = useActionState<PublicFormState, FormData>(submitRegistrationAction.bind(null, token), {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const countFrom = (prefix: string, min: number) => {
    let n = min;
    for (const k of Object.keys(v)) {
      const m = k.match(new RegExp(`^${prefix}\\.(\\d+)\\.`));
      if (m) n = Math.max(n, Number(m[1]) + 1);
    }
    return n;
  };
  const [units, setUnits] = useState(() => countFrom("units", 0));
  const [contacts, setContacts] = useState(() => countFrom("contacts", 1));
  const [personType, setPersonType] = useState(v.person_type || "PJ");

  if (state.done) {
    return (
      <div className="rounded-xl border border-ok/30 bg-white p-8 text-center">
        <CheckCircle2 size={40} className="mx-auto text-ok" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold text-ink">Cadastro enviado</h2>
        <p className="mt-2 text-sm text-muted">
          Recebemos os dados da sua empresa. A equipe AUDITA fará a conferência e entrará em contato, se necessário.
          Obrigado!
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="terms_version" value={termsVersion} />
      {/* Campo-armadilha para robôs */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Section n={1} title="Identificação da empresa">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            Tipo de cadastro<span className="text-danger" aria-hidden> *</span>
          </span>
          <select
            name="person_type"
            value={personType}
            onChange={(ev) => setPersonType(ev.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          >
            <option value="PJ">Pessoa jurídica (CNPJ)</option>
            <option value="PF">Pessoa física (CPF)</option>
          </select>
        </label>
        <Field label={personType === "PJ" ? "Razão social" : "Nome completo"} name="legal_name" defaultValue={v.legal_name} error={e.legal_name} autoComplete="organization" />
        <Field label="Nome fantasia" name="trade_name" required={false} defaultValue={v.trade_name} error={e.trade_name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={personType === "PJ" ? "CNPJ" : "CPF"} name="tax_id" inputMode="numeric" defaultValue={v.tax_id} error={e.tax_id} placeholder={personType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} />
          <Field label="CNAE principal" name="cnae" required={false} inputMode="numeric" defaultValue={v.cnae} error={e.cnae} hint="Se souber. Ex.: 0000-0/00" />
        </div>
        <Field label="Ramo de atividade / segmento" name="segment" required={false} defaultValue={v.segment} error={e.segment} placeholder="Ex.: metalurgia, logística, comércio" />
      </Section>

      <Section n={2} title="Contato geral da empresa">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" name="email" type="email" required={false} defaultValue={v.email} error={e.email} autoComplete="email" />
          <Field label="Telefone" name="phone" required={false} inputMode="tel" defaultValue={v.phone} error={e.phone} placeholder="(15) 3333-4444" autoComplete="tel" />
        </div>
      </Section>

      <Section n={3} title="Endereço da sede">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="CEP" name="address_zip" required={false} inputMode="numeric" defaultValue={v.address_zip} error={e.address_zip} className="sm:col-span-2" autoComplete="postal-code" />
          <Field label="Logradouro" name="address_street" required={false} defaultValue={v.address_street} error={e.address_street} className="sm:col-span-4" autoComplete="address-line1" />
          <Field label="Número" name="address_number" required={false} defaultValue={v.address_number} error={e.address_number} className="sm:col-span-2" />
          <Field label="Complemento" name="address_complement" required={false} defaultValue={v.address_complement} error={e.address_complement} className="sm:col-span-4" />
          <Field label="Bairro" name="address_district" required={false} defaultValue={v.address_district} error={e.address_district} className="sm:col-span-6" />
          <Field label="Município" name="address_city" defaultValue={v.address_city} error={e.address_city} className="sm:col-span-4" autoComplete="address-level2" />
          <SelectField label="UF" name="address_state" required options={UF_OPTIONS} defaultValue={v.address_state} error={e.address_state} className="sm:col-span-2" />
        </div>
      </Section>

      <Section n={4} title="Unidades adicionais" hint="Opcional. Preencha somente se os serviços envolverem outros locais além da sede.">
        {Array.from({ length: units }, (_, i) => (
          <fieldset key={i} className="space-y-3 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Unidade {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome da unidade" name={`units.${i}.name`} defaultValue={v[`units.${i}.name`]} error={e[`units.${i}.name`]} placeholder="Ex.: Filial Votorantim" />
              <Field label="CNPJ da unidade" name={`units.${i}.tax_id`} required={false} inputMode="numeric" defaultValue={v[`units.${i}.tax_id`]} error={e[`units.${i}.tax_id`]} />
              <Field label="Logradouro e número" name={`units.${i}.address_street`} required={false} defaultValue={v[`units.${i}.address_street`]} error={e[`units.${i}.address_street`]} />
              <Field label="Bairro" name={`units.${i}.address_district`} required={false} defaultValue={v[`units.${i}.address_district`]} error={e[`units.${i}.address_district`]} />
              <Field label="Município" name={`units.${i}.address_city`} required={false} defaultValue={v[`units.${i}.address_city`]} error={e[`units.${i}.address_city`]} />
              <SelectField label="UF" name={`units.${i}.address_state`} options={UF_OPTIONS} defaultValue={v[`units.${i}.address_state`]} error={e[`units.${i}.address_state`]} />
              <Field label="CEP" name={`units.${i}.address_zip`} required={false} inputMode="numeric" defaultValue={v[`units.${i}.address_zip`]} error={e[`units.${i}.address_zip`]} />
              <Field label="Contato local" name={`units.${i}.local_contact`} required={false} defaultValue={v[`units.${i}.local_contact`]} error={e[`units.${i}.local_contact`]} placeholder="Portaria, responsável pelo acesso" />
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-3">
          {units < MAX_UNITS && (
            <button type="button" onClick={() => setUnits(units + 1)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-semibold text-navy hover:border-navy/40">
              <Plus size={15} /> Adicionar unidade
            </button>
          )}
          {units > 0 && (
            <button type="button" onClick={() => setUnits(units - 1)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted hover:text-danger">
              <Trash2 size={15} /> Remover última unidade
            </button>
          )}
        </div>
      </Section>

      <Section n={5} title="Contatos e responsáveis" hint="Informe ao menos um contato, com e-mail ou telefone.">
        {Array.from({ length: contacts }, (_, i) => (
          <fieldset key={i} className="space-y-3 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Contato {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" name={`contacts.${i}.full_name`} required={i === 0} defaultValue={v[`contacts.${i}.full_name`]} error={e[`contacts.${i}.full_name`]} autoComplete={i === 0 ? "name" : undefined} />
              <Field label="Cargo / função" name={`contacts.${i}.role_title`} required={false} defaultValue={v[`contacts.${i}.role_title`]} error={e[`contacts.${i}.role_title`]} />
              <Field label="E-mail" name={`contacts.${i}.email`} type="email" required={false} defaultValue={v[`contacts.${i}.email`]} error={e[`contacts.${i}.email`]} />
              <Field label="Telefone" name={`contacts.${i}.phone`} required={false} inputMode="tel" defaultValue={v[`contacts.${i}.phone`]} error={e[`contacts.${i}.phone`]} />
              <SelectField
                label="Vínculo"
                name={`contacts.${i}.unit_index`}
                options={[{ value: "", label: "Sede / empresa em geral" }, ...Array.from({ length: units }, (_, u) => ({ value: String(u), label: `Unidade ${u + 1}` }))]}
                defaultValue={v[`contacts.${i}.unit_index`]}
              />
              <Field label="Finalidade" name={`contacts.${i}.purpose`} required={false} defaultValue={v[`contacts.${i}.purpose`]} error={e[`contacts.${i}.purpose`]} placeholder="Comercial, financeiro, técnico…" />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name={`contacts.${i}.is_primary`} defaultChecked={v[`contacts.${i}.is_primary`] === "on" || (i === 0 && !state.values)} className="size-4 accent-navy" />
              Contato principal da empresa
            </label>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-3">
          {contacts < MAX_CONTACTS && (
            <button type="button" onClick={() => setContacts(contacts + 1)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-semibold text-navy hover:border-navy/40">
              <Plus size={15} /> Adicionar contato
            </button>
          )}
          {contacts > 1 && (
            <button type="button" onClick={() => setContacts(contacts - 1)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted hover:text-danger">
              <Trash2 size={15} /> Remover último contato
            </button>
          )}
        </div>
      </Section>

      <Section n={6} title="Observações">
        <TextAreaField label="Informações adicionais" name="notes" defaultValue={v.notes} error={e.notes} rows={3} maxLength={4000} />
      </Section>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-navy">7. {termsTitle}</h2>
        <details className="group mt-3 rounded-lg border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-navy">
            Ler termo completo
            <ChevronDown size={18} className="transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-3 border-t border-line px-4 py-3 text-sm leading-relaxed text-ink">
            {termsBody.split(/\n\n+/).map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
            <p className="text-xs text-muted">Versão do termo: {termsVersion}</p>
          </div>
        </details>
        <label className={`mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${e.accept_terms ? "border-danger bg-danger/5" : "border-line"}`}>
          <input type="checkbox" name="accept_terms" className="mt-0.5 size-5 shrink-0 accent-navy" />
          <span className="text-ink">
            Li e aceito a declaração e os termos de proteção de dados.<span className="text-danger" aria-hidden> *</span>
          </span>
        </label>
      </section>

      <SubmitButton pendingText="Enviando…">Enviar cadastro</SubmitButton>
    </form>
  );
}
