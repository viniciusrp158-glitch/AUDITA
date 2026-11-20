"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ban, ChevronRight, Mail, MessageCircle, Pencil, Phone, SkipForward, Sparkles } from "lucide-react";
import { Alert } from "@/components/form";
import { formatCnae, formatPhone, formatTaxId } from "@/lib/br";
import { applyMask } from "@/lib/mask";
import { companyDisplayName, emailText, whatsappMessage } from "@/lib/prospect/messages";
import { whatsappLink } from "@/lib/prospect/labels";
import { discardAction, markAccountingAction, quickContactAction } from "./actions";

export type CardItem = {
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  municipality: string;
  km: number | null;
  niche_name: string;
  niche_code: string | null;
  size_label: string;
  score: number;
  own_phone: boolean;
  own_email: boolean;
  phone: string | null;
  email: string | null;
  cnae_main: string;
  years: number | null;
  reasons: string[];
  group: string;
};

type Kind = "whatsapp" | "ligacao" | "email";
const RESULTS: Record<Kind, { value: string; label: string; tone?: "ok" | "warn" }[]> = {
  whatsapp: [
    { value: "enviado", label: "Enviei a mensagem", tone: "ok" },
    { value: "interesse", label: "Respondeu: tem interesse", tone: "ok" },
    { value: "numero_errado", label: "Número sem WhatsApp / errado" },
    { value: "nao_contatar", label: "Pediu para não contatar", tone: "warn" },
  ],
  email: [
    { value: "enviado", label: "Enviei o e-mail", tone: "ok" },
    { value: "numero_errado", label: "E-mail voltou / errado" },
  ],
  ligacao: [
    { value: "nao_atendeu", label: "Não atendeu" },
    { value: "interesse", label: "Tem interesse", tone: "ok" },
    { value: "reuniao_marcada", label: "Reunião marcada 🎉", tone: "ok" },
    { value: "retornar_depois", label: "Pediu contato depois" },
    { value: "numero_errado", label: "Contato errado" },
    { value: "nao_contatar", label: "Pediu para não contatar", tone: "warn" },
  ],
};

export function OpportunityCard({ item, userName, position, total, nextHref }: { item: CardItem; userName: string; position: number; total: number; nextHref: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "info" | "error" | "celebrate"; text: string } | null>(null);
  const [channel, setChannel] = useState<Kind | null>(null);
  const [editPhone, setEditPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState("");
  const company = companyDisplayName(item.trade_name, item.legal_name);
  const usePhone = phone.replace(/\D/g, "") || (item.phone ?? "");
  const [text, setText] = useState(() => whatsappMessage({ userName, company, nicheCode: item.niche_code }));
  const wa = useMemo(() => (usePhone ? whatsappLink(usePhone, text) : null), [usePhone, text]);
  const mail = useMemo(() => {
    if (!item.email) return null;
    const e = emailText({ userName, company, nicheCode: item.niche_code });
    return `mailto:${item.email}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;
  }, [item.email, item.niche_code, company, userName]);

  const run = (fn: () => Promise<{ ok?: string; error?: string; celebrate?: boolean }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) return setMsg({ kind: "error", text: r.error });
      setMsg({ kind: r.celebrate ? "celebrate" : "info", text: r.ok ?? "Feito." });
      setChannel(null);
      setDiscarding(false);
      setPhone("");
      setEditPhone(false);
      router.refresh(); // a empresa sai da carteira: a próxima aparece no lugar
    });

  const tag = (own: boolean) =>
    own ? (
      <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok">da empresa</span>
    ) : (
      <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">provável contabilidade</span>
    );
  const btn = "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold transition active:scale-[0.98]";

  return (
    <article aria-label="Empresa em análise" className="rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy text-lg font-bold tabular-nums text-white" title="Nota (0 a 100)">
          {item.score}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-ink">{company}</h2>
          <p className="truncate text-xs text-muted">{item.legal_name}</p>
          <p className="text-xs tabular-nums text-muted" data-testid="cnpj">CNPJ {formatTaxId(item.cnpj)}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-surface px-2 py-0.5 font-medium text-ink">{item.size_label}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-ink">{item.niche_name}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-ink">
              {item.municipality}
              {item.km !== null ? ` · ${Math.round(item.km)} km` : ""}
            </span>
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {position}/{total}
        </span>
      </header>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Por que está aqui">
        {item.reasons.map((r) => (
          <li key={r} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink">
            <Sparkles size={12} className="text-green-dark" aria-hidden /> {r}
          </li>
        ))}
        <li className="rounded-md border border-line px-2 py-1 text-xs text-muted">
          CNAE {formatCnae(item.cnae_main)}
          {item.years !== null ? ` · ${item.years} ${item.years === 1 ? "ano" : "anos"}` : ""}
        </li>
      </ul>

      <dl className="mt-3 space-y-2 rounded-xl bg-surface/60 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="sr-only">Telefone</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <Phone size={14} className="text-muted" aria-hidden />
            <span className="tabular-nums text-ink">{phone ? applyMask("phone", phone) : item.phone ? formatPhone(item.phone) : "Sem telefone"}</span>
            {!phone && item.phone && tag(item.own_phone)}
            {phone && <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok">corrigido</span>}
          </dd>
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={() => setEditPhone((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs text-ink">
              <Pencil size={12} /> Corrigir número
            </button>
            {item.phone && item.own_phone && (
              <button type="button" disabled={pending} onClick={() => run(() => markAccountingAction({ cnpj: item.cnpj, kind: "phone" }))} className="rounded-md border border-line bg-white px-2 py-1 text-xs text-muted">
                É da contabilidade
              </button>
            )}
          </span>
        </div>
        {editPhone && (
          <label className="block text-xs text-muted">
            Número da empresa (com DDD) — vale para o WhatsApp e a ligação e fica salvo no lead
            <input
              autoFocus
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(applyMask("phone", e.target.value))}
              placeholder="(15) 99999-9999"
              aria-label="Número correto da empresa"
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-navy"
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <dt className="sr-only">E-mail</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <Mail size={14} className="text-muted" aria-hidden />
            <span className="break-all text-ink">{item.email ?? "Sem e-mail"}</span>
            {item.email && tag(item.own_email)}
          </dd>
          {item.email && item.own_email && (
            <button type="button" disabled={pending} onClick={() => run(() => markAccountingAction({ cnpj: item.cnpj, kind: "email" }))} className="ml-auto rounded-md border border-line bg-white px-2 py-1 text-xs text-muted">
              É da contabilidade
            </button>
          )}
        </div>
      </dl>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-navy">Ver / ajustar a mensagem do WhatsApp</summary>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={1500} aria-label="Mensagem do WhatsApp" className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy" />
      </details>

      {msg &&
        (msg.kind === "celebrate" ? (
          <p role="status" className="mt-3 animate-[pop_0.5s_ease-out] rounded-xl bg-ok px-4 py-3 text-center text-base font-semibold text-white shadow">
            {msg.text}
          </p>
        ) : (
          <div className="mt-3">
            <Alert kind={msg.kind}>{msg.text}</Alert>
          </div>
        ))}

      {channel ? (
        <section aria-label="Como foi o contato" className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t border-line bg-white px-4 py-3 sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:border-0 lg:p-0">
          <p className="mb-2 text-sm font-semibold text-ink">Como foi? (um toque registra e passa para a próxima)</p>
          <div className="grid grid-cols-2 gap-2">
            {RESULTS[channel].map((r) => (
              <button
                key={r.value}
                type="button"
                disabled={pending}
                onClick={() => run(() => quickContactAction({ cnpj: item.cnpj, kind: channel, outcome: r.value, phone: phone || undefined, group: item.group, score: item.score }))}
                className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                  r.tone === "ok" ? "border-ok bg-ok text-white" : r.tone === "warn" ? "border-danger/40 text-danger" : "border-line bg-white text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setChannel(null)} className="mt-2 text-xs text-muted underline">
            Voltar
          </button>
        </section>
      ) : (
        <section aria-label="Contatar" className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t border-line bg-white px-4 py-3 sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:border-0 lg:p-0 grid grid-cols-3 gap-2">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => setChannel("whatsapp")} className={`${btn} bg-ok text-white`}>
              <MessageCircle size={20} /> WhatsApp
            </a>
          ) : (
            <span className={`${btn} border border-dashed border-line text-xs text-muted`}>Sem número</span>
          )}
          {usePhone ? (
            <a href={`tel:+55${usePhone}`} onClick={() => setChannel("ligacao")} className={`${btn} border border-line bg-white text-ink`}>
              <Phone size={20} /> Ligar
            </a>
          ) : (
            <span className={`${btn} border border-dashed border-line text-xs text-muted`}>Sem telefone</span>
          )}
          {mail ? (
            <a href={mail} onClick={() => setChannel("email")} className={`${btn} border border-line bg-white text-ink`}>
              <Mail size={20} /> E-mail
            </a>
          ) : (
            <span className={`${btn} border border-dashed border-line text-xs text-muted`}>Sem e-mail</span>
          )}
        </section>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        {discarding ? (
          <form
            className="flex w-full flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => discardAction({ cnpj: item.cnpj, reason }));
            }}
          >
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Por quê? (ex.: atividade não tem a ver)" aria-label="Motivo do descarte" className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm" />
            <button type="submit" disabled={pending} className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white">
              Descartar
            </button>
            <button type="button" onClick={() => setDiscarding(false)} className="text-sm text-muted">
              Cancelar
            </button>
          </form>
        ) : (
          <>
            <button type="button" onClick={() => setDiscarding(true)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
              <Ban size={15} /> Não é para nós
            </button>
            {nextHref ? (
              <Link href={nextHref} scroll={false} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink">
                <SkipForward size={15} /> Pular <ChevronRight size={14} />
              </Link>
            ) : null}
          </>
        )}
      </footer>
    </article>
  );
}
