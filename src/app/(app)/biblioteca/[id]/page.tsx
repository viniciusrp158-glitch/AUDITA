import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Alert } from "@/components/form";
import { LibStatusPill } from "@/components/library-status";
import { Card, DefinitionList } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime, formatDay } from "@/lib/format";
import { formatBytes, PHASES } from "@/lib/library/labels";
import { getLibDocumentOr404, templatesBySha, type LibRevision } from "@/lib/library/queries";
import { cancelRevisionAction, publishRevisionAction } from "../actions";
import { CancelRevisionForm, PublishRevisionForm, UploadRevisionForm } from "./library-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { doc } = await getLibDocumentOr404(id);
  return { title: `${doc.doc_code} · Biblioteca` };
}

function DownloadLink({ r, label }: { r: LibRevision; label?: string }) {
  return (
    <a
      href={`/biblioteca/arquivo/${r.id}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy/40"
      title={`SHA-256 ${r.sha256}`}
    >
      <Download size={14} /> {label ?? "Baixar"} <span className="font-normal text-muted">({formatBytes(r.size_bytes)})</span>
    </a>
  );
}

function nextRevision(revs: LibRevision[]): string {
  const n = revs.length ? Math.max(...revs.map((r) => Number(r.revision.slice(4)))) + 1 : 0;
  return `Rev.${String(Math.min(n, 99)).padStart(2, "0")}`;
}

export default async function BibliotecaDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string; publicada?: string; cancelada?: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;
  const { doc, parent, annexes } = await getLibDocumentOr404(id);
  const revs = doc.library_revisions;
  const vigente = revs.find((r) => r.status === "vigente") ?? null;
  const drafts = revs.filter((r) => r.status === "rascunho");
  const usedBy = await templatesBySha(revs.map((r) => r.sha256));

  return (
    <>
      <Link href="/biblioteca" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Biblioteca
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white">{doc.doc_code}</span>
          {vigente ? <LibStatusPill status="vigente" /> : <span className="text-xs font-semibold text-warn">Sem revisão vigente</span>}
          {doc.status === "inativo" && <span className="text-xs text-muted">Documento inativo</span>}
        </div>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-ink">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {doc.family} · {PHASES[doc.phase].label}
          {parent && (
            <>
              {" "}
              · anexo de{" "}
              <Link href={`/biblioteca/${parent.id}`} className="font-mono text-xs text-navy hover:underline">
                {parent.doc_code}
              </Link>
            </>
          )}
        </p>
      </header>

      <div className="mb-4 space-y-3">
        {sp.criado && <Alert kind="info">Documento cadastrado. Envie o arquivo da primeira revisão.</Alert>}
        {sp.publicada && <Alert kind="info">Revisão publicada como vigente. A anterior continua acessível como substituída.</Alert>}
        {sp.cancelada && <Alert kind="info">Rascunho cancelado. O registro continua no histórico.</Alert>}
        {doc.notes && <Alert kind="warning">{doc.notes}</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Revisão vigente">
            {vigente ? (
              <div className="space-y-3" data-testid="vigente">
                <DefinitionList
                  items={[
                    { label: "Revisão", value: vigente.revision },
                    { label: "Aprovado por", value: vigente.approved_by },
                    { label: "Aprovação", value: formatDay(vigente.approved_on) },
                    { label: "Emissão", value: formatDay(vigente.issued_on) },
                    { label: "Arquivo", value: <span className="break-all">{vigente.original_name}</span> },
                    { label: "SHA-256", value: <span className="break-all font-mono text-xs">{vigente.sha256}</span> },
                  ]}
                />
                {vigente.notes && <p className="text-xs text-muted">{vigente.notes}</p>}
                {usedBy[vigente.sha256] && (
                  <p className="text-xs text-ok">Base dos modelos técnicos do sistema: {usedBy[vigente.sha256].join(", ")} (mesmo SHA-256).</p>
                )}
                <DownloadLink r={vigente} label={`Baixar ${vigente.revision}`} />
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhuma revisão vigente. Rascunhos e minutas nunca são marcados como vigentes sem aprovação registrada.</p>
            )}
          </Card>

          {drafts.map((r) => (
            <Card key={r.id} title={`Rascunho ${r.revision} — aguardando aprovação`}>
              <div className="space-y-4" data-testid="draft">
                <p className="text-sm text-ink">
                  <span className="break-all">{r.original_name}</span> · {formatBytes(r.size_bytes)} · enviado em {formatDateTime(r.created_at)}
                </p>
                {r.notes && <p className="text-xs text-warn">{r.notes}</p>}
                <DownloadLink r={r} label="Baixar para conferir" />
                <PublishRevisionForm action={publishRevisionAction.bind(null, doc.id, r.id)} initial={r} />
                <details className="rounded-lg border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">Cancelar este rascunho</summary>
                  <div className="border-t border-line p-3">
                    <CancelRevisionForm action={cancelRevisionAction.bind(null, doc.id, r.id)} />
                  </div>
                </details>
              </div>
            </Card>
          ))}

          <Card title={`Histórico de revisões (${revs.length})`}>
            {revs.length === 0 ? (
              <p className="text-sm text-muted">Nenhum arquivo enviado.</p>
            ) : (
              <ol className="space-y-2" data-testid="revisions">
                {revs.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-navy">{r.revision}</span>
                      <LibStatusPill status={r.status} />
                      <span className="text-xs text-muted">
                        {r.approved_on ? `aprovada em ${formatDay(r.approved_on)}` : "sem aprovação registrada"} · {formatBytes(r.size_bytes)}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted">SHA-256 {r.sha256}</p>
                    {r.status_note && <p className="mt-1 text-xs text-muted">{r.status_note}</p>}
                    <div className="mt-2">
                      <DownloadLink r={r} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-4 lg:self-start">
          <Card title="Enviar nova revisão">
            {doc.status === "ativo" ? (
              <UploadRevisionForm documentId={doc.id} nextRevision={nextRevision(revs)} />
            ) : (
              <p className="text-sm text-muted">Documento inativo.</p>
            )}
          </Card>
          <Card title="Identificação">
            <DefinitionList
              items={[
                { label: "Código", value: doc.doc_code },
                { label: "Tipo", value: doc.kind === "anexo" ? "Anexo" : "Documento" },
                { label: "Visibilidade", value: doc.visibility === "interno" ? "Interno (cliente não acessa)" : "Externo" },
                { label: "Cadastro", value: formatDateTime(doc.created_at) },
              ]}
            />
            {annexes.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Anexos</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {annexes.map((a) => (
                    <li key={a.id}>
                      <Link href={`/biblioteca/${a.id}`} className="text-navy hover:underline">
                        <span className="font-mono text-xs">{a.doc_code}</span> — {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
