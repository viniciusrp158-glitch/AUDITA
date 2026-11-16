"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, SubmitButton } from "@/components/form";
import { ACTIVITY_KINDS, OUTCOMES, renderTemplate, STAGES, TEMPLATES, whatsappLink } from "@/lib/prospect/labels";
import { moveStageAction, registerActivityAction, suppressAction, updateContactAction, type ProspectState } from "../../actions";

const input = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";
const label = "block text-sm font-medium text-ink";
const err = (s: ProspectState, k: string) => (s.fieldErrors?.[k] ? <span className="mt-1 block text-xs text-danger">{s.fieldErrors[k]}</span> : null);

/** Contato assistido: o sistema prepara a mensagem e abre o WhatsApp, o e-mail ou a ligação; quem envia é a pessoa. */
export function ContactPanel({
  leadId,
  company,
  sender,
  defaultTemplate,
  whatsapp,
  whatsappSource,
  phone,
  email,
  blocked,
}: {
  leadId: string;
  company: string;
  sender: string;
  defaultTemplate: string;
  whatsapp: string | null;
  whatsappSource: string | null;
  phone: string | null;
  email: string | null;
  blocked: boolean;
}) {
  const [tpl, setTpl] = useState(defaultTemplate);
  const [text, setText] = useState(() => renderTemplate(defaultTemplate, { empresa: company, remetente: sender }));
  const [kind, setKind] = useState<string>("whatsapp");
  const [state, action] = useActionState<ProspectState, FormData>(registerActivityAction, {});
  const wa = useMemo(() => whatsappLink(whatsapp, text), [whatsapp, text]);
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent(`AUDITA | SSMA & SGI — ${company}`)}&body=${encodeURIComponent(text)}` : null;

  if (blocked) return <Alert kind="warning">Empresa na lista &quot;não contatar&quot;: o contato pelo sistema está bloqueado. Só anotações internas.</Alert>;

  return (
    <div className="space-y-4">
      <label className={label}>
        Modelo de mensagem
        <select
          value={tpl}
          onChange={(e) => {
            setTpl(e.target.value);
            setText(renderTemplate(e.target.value, { empresa: company, remetente: sender }));
          }}
          className={`mt-1 ${input}`}
        >
          {TEMPLATES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Mensagem (revise antes de enviar)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={1500} className={`mt-1 ${input}`} />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => setKind("whatsapp")} className="rounded-md bg-ok px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90">
            Abrir no WhatsApp
          </a>
        ) : (
          <span className="rounded-md border border-dashed border-line px-3 py-2 text-center text-xs text-muted">Sem celular para WhatsApp — confirme o número abaixo</span>
        )}
        {phone ? (
          <a href={`tel:+55${phone}`} onClick={() => setKind("ligacao")} className="rounded-md border border-line bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink hover:border-navy/40">
            Ligar
          </a>
        ) : (
          <span className="rounded-md border border-dashed border-line px-3 py-2 text-center text-xs text-muted">Sem telefone</span>
        )}
        {mail ? (
          <a href={mail} onClick={() => setKind("email")} className="rounded-md border border-line bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink hover:border-navy/40">
            Escrever e-mail
          </a>
        ) : (
          <span className="rounded-md border border-dashed border-line px-3 py-2 text-center text-xs text-muted">Sem e-mail</span>
        )}
      </div>
      {whatsappSource && <p className="text-xs text-muted">{whatsappSource}</p>}

      <form action={action} className="space-y-3 rounded-lg border border-line bg-surface/40 p-3">
        <input type="hidden" name="id" value={leadId} />
        <input type="hidden" name="template_code" value={tpl} />
        <p className="text-sm font-semibold text-ink">Registrar o contato</p>
        {state.error && <Alert kind="error">{state.error}</Alert>}
        {state.ok && <Alert kind="info">{state.ok}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Canal
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`mt-1 ${input}`}>
              {ACTIVITY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {kind !== "anotacao" && (
            <label className={label}>
              Como foi
              <select name="outcome" defaultValue="" className={`mt-1 ${input}`}>
                <option value="" disabled>
                  Escolha…
                </option>
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {err(state, "outcome")}
            </label>
          )}
        </div>
        <label className={label}>
          Observação
          <textarea name="note" rows={2} maxLength={2000} className={`mt-1 ${input}`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Próximo retorno
            <input type="date" name="next_action_at" className={`mt-1 ${input}`} />
          </label>
          <label className={label}>
            O que fazer no retorno
            <input name="next_action_note" maxLength={300} placeholder="Ex.: ligar para confirmar reunião" className={`mt-1 ${input}`} />
          </label>
        </div>
        <SubmitButton pendingText="Registrando…">Registrar</SubmitButton>
      </form>
    </div>
  );
}

export function StageForm({ leadId, stage }: { leadId: string; stage: string }) {
  const [state, action] = useActionState<ProspectState, FormData>(moveStageAction, {});
  const [value, setValue] = useState(stage);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={leadId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <label className={label}>
        Etapa
        <select name="stage" value={value} onChange={(e) => setValue(e.target.value)} className={`mt-1 ${input}`}>
          {STAGES.filter((s) => s.value !== "cliente").map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {value === "perdido" && (
        <label className={label}>
          Motivo
          <input name="lost_reason" maxLength={500} required className={`mt-1 ${input}`} placeholder="Ex.: fora do perfil, já tem fornecedor" />
          {err(state, "lost_reason")}
        </label>
      )}
      <SubmitButton pendingText="Salvando…" variant="secondary">
        Mudar etapa
      </SubmitButton>
    </form>
  );
}

export function ConfirmedContactForm({
  leadId,
  values,
}: {
  leadId: string;
  values: { contact_person: string; phone_confirmed: string; whatsapp_confirmed: string; email_confirmed: string };
}) {
  const [state, action] = useActionState<ProspectState, FormData>(updateContactAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={leadId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <label className={label}>
        Pessoa de contato
        <input name="contact_person" defaultValue={values.contact_person} maxLength={120} className={`mt-1 ${input}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          WhatsApp confirmado
          <input name="whatsapp_confirmed" defaultValue={values.whatsapp_confirmed} inputMode="tel" placeholder="DDD + número" className={`mt-1 ${input}`} />
          {err(state, "whatsapp_confirmed")}
        </label>
        <label className={label}>
          Telefone confirmado
          <input name="phone_confirmed" defaultValue={values.phone_confirmed} inputMode="tel" placeholder="DDD + número" className={`mt-1 ${input}`} />
          {err(state, "phone_confirmed")}
        </label>
      </div>
      <label className={label}>
        E-mail confirmado
        <input name="email_confirmed" type="email" defaultValue={values.email_confirmed} className={`mt-1 ${input}`} />
        {err(state, "email_confirmed")}
      </label>
      <SubmitButton pendingText="Salvando…" variant="secondary">
        Salvar contato
      </SubmitButton>
    </form>
  );
}

export function SuppressForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState<ProspectState, FormData>(suppressAction, {});
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-md border border-danger/30 bg-white px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/5">
        Marcar como &quot;não contatar&quot;
      </button>
    );
  return (
    <form action={action} className="space-y-3 rounded-lg border border-danger/30 p-3">
      <input type="hidden" name="id" value={leadId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <p className="text-xs text-muted">O registro é permanente: a empresa sai do funil e o sistema bloqueia novos contatos.</p>
      <label className={label}>
        Motivo
        <input name="reason" required maxLength={500} placeholder="Ex.: pediu por WhatsApp para não ser contatada" className={`mt-1 ${input}`} />
      </label>
      <SubmitButton pendingText="Registrando…" variant="danger">
        Confirmar &quot;não contatar&quot;
      </SubmitButton>
    </form>
  );
}
