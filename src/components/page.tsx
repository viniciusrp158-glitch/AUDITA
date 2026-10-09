import { Hammer } from "lucide-react";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
    </header>
  );
}

/** Placeholder honesto para módulos ainda não desenvolvidos (sem dados simulados). */
export function UnderConstruction({ increment, items }: { increment: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-dashed border-line bg-white p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-navy">
        <Hammer size={16} className="text-green-dark" /> Módulo previsto no {increment}
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}
