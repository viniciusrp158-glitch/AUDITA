import { formatCep, formatCnpj, formatPhone } from "@/lib/br";
import { formatDateTime } from "@/lib/format";
import { FIELD_GROUPS, INSTITUTIONAL_STATUS, issuerLine, proponentText, type InstitutionalProfile, type InstitutionalStatus } from "@/lib/institutional";

export function InstitutionalStatusPill({ status }: { status: InstitutionalStatus }) {
  const s = INSTITUTIONAL_STATUS[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export const Pendente = () => <span className="font-semibold text-warn">PENDENTE</span>;

function display(key: string, v: string | null): React.ReactNode {
  if (!v) return null;
  if (key === "cnpj") return formatCnpj(v);
  if (key === "address_zip") return formatCep(v);
  if (key === "phone") return formatPhone(v);
  return v;
}

/** Dados de uma versão, por grupo; essenciais vazios aparecem como PENDENTE. */
export function ProfileView({ p }: { p: InstitutionalProfile }) {
  return (
    <div className="space-y-5">
      {FIELD_GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="mb-2 text-sm font-semibold text-navy">{g.title}</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.fields.map((f) => (
              <div key={f.key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</dt>
                <dd className="mt-0.5 break-words text-sm text-ink">
                  {display(f.key, p[f.key]) ?? (f.essential ? <Pendente /> : <span className="text-muted">—</span>)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-xs text-muted">
        Endereço completo na proposta: {p.full_address_on_proposal ? "sim" : "não"} · Responsável técnico na proposta:{" "}
        {p.show_technical_lead ? "sim" : "não"}
        {p.published_at ? ` · Publicada em ${formatDateTime(p.published_at)}` : ""}
      </p>
      {p.notes && <p className="whitespace-pre-line rounded-md bg-surface px-3 py-2 text-xs text-muted">Observações internas: {p.notes}</p>}
    </div>
  );
}

/** Como o proponente sai nos documentos (campo do M01 e rodapé). */
export function ProposalPreview({ p }: { p: InstitutionalProfile | null }) {
  return (
    <div className="space-y-2 text-sm" data-testid="proposal-preview">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Empresa proponente (AUDDOC010-ANX01)</p>
      <p className="whitespace-pre-line rounded-md border border-line bg-surface px-3 py-2 text-ink">{proponentText(p)}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Rodapé dos documentos</p>
      <p className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink">{issuerLine(p)} · Gerado pelo sistema AUDITA…</p>
    </div>
  );
}
