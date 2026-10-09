"use client";

import { useFormStatus } from "react-dom";

const inputCls =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-ink shadow-xs outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15 disabled:bg-surface disabled:text-muted";

type BaseProps = {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
};

function FieldShell({
  label,
  name,
  required,
  hint,
  error,
  className,
  children,
}: BaseProps & { children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`} htmlFor={name}>
      <span className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </span>
      {children}
      {error ? (
        <span id={`${name}-error`} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={`${name}-hint`} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  hint,
  error,
  defaultValue,
  placeholder,
  inputMode,
  maxLength,
  className,
}: BaseProps & {
  type?: string;
  autoComplete?: string;
  defaultValue?: string | null;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint} error={error} className={className}>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${inputCls} ${error ? "border-danger" : "border-line"}`}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required = false,
  error,
  hint,
  className,
}: BaseProps & { options: { value: string; label: string }[]; defaultValue?: string | null }) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint} error={error} className={className}>
      {/* key: remonta o select quando o valor devolvido pelo servidor muda; sem isso, o reset
          automático do formulário (React 19) volta o select à opção inicial após um erro. */}
      <select
        key={defaultValue ?? ""}
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        className={`${inputCls} ${error ? "border-danger" : "border-line"}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  defaultValue,
  required = false,
  error,
  hint,
  rows = 3,
  maxLength,
  className,
}: BaseProps & { defaultValue?: string | null; rows?: number; maxLength?: number }) {
  return (
    <FieldShell label={label} name={name} required={required} hint={hint} error={error} className={className}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue ?? undefined}
        aria-invalid={error ? true : undefined}
        className={`${inputCls} ${error ? "border-danger" : "border-line"}`}
      />
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 size-4 rounded border-line accent-navy"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  full = true,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary" | "danger";
  full?: boolean;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-navy text-white hover:bg-navy-700",
    secondary: "border border-line bg-white text-ink hover:border-navy/40",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${full ? "w-full" : ""} rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70 ${styles}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "info" | "warning"; children: React.ReactNode }) {
  const styles = {
    error: "border-danger/30 bg-danger/5 text-danger",
    info: "border-ok/30 bg-ok/5 text-ok",
    warning: "border-warn/40 bg-warn/5 text-warn",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}
