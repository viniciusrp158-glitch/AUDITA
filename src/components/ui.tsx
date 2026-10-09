import Link from "next/link";

export function StatusBadge({ status }: { status: "ativo" | "inativo" | string }) {
  const active = status === "ativo";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-ok/10 text-ok" : "bg-surface text-muted"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${active ? "bg-ok" : "bg-muted"}`} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function TestBadge() {
  return (
    <span className="inline-flex rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn" title="Registro fictício de teste">
      TESTE
    </span>
  );
}

export function CodeBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white">
      {code}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-navy text-white hover:bg-navy-700"
      : "border border-line bg-white text-ink hover:border-navy/40";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${styles}`}>
      {children}
    </Link>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{i.label}</dt>
          <dd className="mt-0.5 text-sm text-ink">{i.value || <span className="text-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
