"use client";

import { useActionState, useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { Alert, Field, SubmitButton } from "@/components/form";
import { LEVEL_HINT, LEVEL_LABEL, LEVELS, type AccessLevel } from "@/lib/permissions";
import type { AccountState } from "./actions";
import { setThemeAction } from "./actions";

type Act = (s: AccountState, f: FormData) => Promise<AccountState>;

export function ProfileForm({ action, initial }: { action: Act; initial: { full_name: string; job_title: string | null } }) {
  const [state, formAction] = useActionState<AccountState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate data-testid="profile-form">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="full_name" defaultValue={initial.full_name} error={e.full_name} maxLength={160} autoComplete="name" />
        <Field label="Cargo" name="job_title" required={false} defaultValue={initial.job_title ?? ""} error={e.job_title} maxLength={120} hint="Ex.: Diretor" />
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
      </div>
    </form>
  );
}

export function ThemeChoice({ initial }: { initial: "claro" | "escuro" }) {
  const [theme, setTheme] = useState(initial);
  const [, start] = useTransition();
  function choose(t: "claro" | "escuro") {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    start(() => void setThemeAction(t));
  }
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tema da interface">
      {(
        [
          ["claro", "Tema claro", Sun],
          ["escuro", "Tema escuro", Moon],
        ] as const
      ).map(([t, label, Icon]) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => choose(t)}
          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition ${
            theme === t ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/40"
          }`}
        >
          <Icon size={16} aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

const ROLE_OPTIONS = LEVELS.map((r) => ({ value: r, label: LEVEL_LABEL[r] }));

/** Senha provisória sugerida (16 caracteres, letras e números), gerada no navegador. */
function suggestPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  let p = Array.from(buf, (n) => chars[n % chars.length]).join("");
  if (!/[0-9]/.test(p)) p = p.slice(0, 15) + "7";
  if (!/[A-Za-z]/.test(p)) p = "a" + p.slice(1);
  return p;
}

export function CreateUserForm({ action }: { action: Act }) {
  const [state, formAction] = useActionState<AccountState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const [role, setRole] = useState<AccessLevel>("operador");
  const [pwd, setPwd] = useState("");
  return (
    <form action={formAction} className="space-y-4" noValidate data-testid="create-user-form" key={state.seq ?? 0}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="info">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" name="nome" error={e.nome} maxLength={160} />
        <Field label="E-mail de acesso" name="email" type="email" error={e.email} autoComplete="off" />
        <Field label="Cargo" name="cargo" required={false} error={e.cargo} maxLength={120} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            Nível de acesso<span className="text-danger" aria-hidden> *</span>
          </span>
          <select
            name="nivel"
            value={role}
            onChange={(ev) => setRole(ev.target.value as AccessLevel)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted" data-testid="role-hint">
            {LEVEL_HINT[role]}
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 basis-60">
          <span className="mb-1 block text-sm font-medium text-ink">
            Senha provisória<span className="text-danger" aria-hidden> *</span>
          </span>
          <input
            name="senha"
            type="text"
            value={pwd}
            onChange={(ev) => setPwd(ev.target.value)}
            autoComplete="off"
            className={`w-full rounded-md border bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 ${
              e.senha ? "border-danger" : "border-line"
            }`}
          />
          <span className={`mt-1 block text-xs ${e.senha ? "text-danger" : "text-muted"}`}>
            {e.senha ?? "12 caracteres ou mais, com letras e números. O usuário troca no primeiro acesso."}
          </span>
        </label>
        <button
          type="button"
          onClick={() => setPwd(suggestPassword())}
          className="mb-6 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-navy hover:border-navy/40"
        >
          Gerar senha
        </button>
      </div>
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Criando…">Criar usuário</SubmitButton>
      </div>
    </form>
  );
}

export function AccessForm({ action, role, status }: { action: Act; role: AccessLevel; status: "active" | "inactive" }) {
  const [state, formAction] = useActionState<AccountState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" data-testid="access-form">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Nível</span>
        <select name="nivel" defaultValue={role} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink">
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Situação</span>
        <select name="situacao" defaultValue={status} className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink">
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </label>
      <div className="w-32">
        <SubmitButton pendingText="Salvando…" variant="secondary">
          Salvar acesso
        </SubmitButton>
      </div>
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-ok">{state.ok}</p>}
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: Act }) {
  const [state, formAction] = useActionState<AccountState, FormData>(action, {});
  const [pwd, setPwd] = useState("");
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" data-testid="reset-form">
      <label className="block min-w-0 flex-1 basis-48">
        <span className="mb-1 block text-xs text-muted">Nova senha provisória</span>
        <input
          name="senha"
          type="text"
          value={pwd}
          onChange={(ev) => setPwd(ev.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-line bg-white px-2 py-1.5 font-mono text-sm text-ink"
        />
      </label>
      <button
        type="button"
        onClick={() => setPwd(suggestPassword())}
        className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-navy hover:border-navy/40"
      >
        Gerar
      </button>
      <div className="w-36">
        <SubmitButton pendingText="Salvando…" variant="secondary">
          Redefinir senha
        </SubmitButton>
      </div>
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-ok">{state.ok}</p>}
    </form>
  );
}

