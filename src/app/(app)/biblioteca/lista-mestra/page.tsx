import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatDay } from "@/lib/format";
import { getMasterListState, MASTER_LIST_CODE, MASTER_LIST_TITLE, masterListWarnings } from "@/lib/library/master-list";
import { COMMERCIAL_STATUS } from "@/lib/services/labels";
import { PublishMasterListForm } from "./publish-form";

export const metadata = { title: "Lista mestra" };

export default async function ListaMestraPage({ searchParams }: { searchParams: Promise<{ publicada?: string }> }) {
  const me = await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const s = await getMasterListState();
  const released = s.data.services.filter((x) => x.catalog_status === "ativo" && x.commercial_status === "apto_comercialmente");
  const warnings = masterListWarnings(s.data);
  const pending = s.data.services.filter((x) => x.catalog_status === "ativo" && x.commercial_status !== "apto_comercialmente");

  return (
    <>
      <Link href="/biblioteca" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={14} /> Biblioteca
      </Link>
      <PageHeader
        title={`${MASTER_LIST_CODE} — ${MASTER_LIST_TITLE}`}
        description="Gerada sozinha a partir do catálogo de serviços e dos treinamentos EAD. Quando algo muda, o sistema avisa; você confere e aprova a nova revisão aqui, sem baixar, editar ou enviar arquivos."
      />

      {sp.publicada && (
        <div className="mb-4">
          <Alert kind="info">
            {sp.publicada} publicada como vigente na Biblioteca.
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card title={`Serviços liberados para orçamento (${released.length})`}>
            <ul className="divide-y divide-line text-sm">
              {released.map((x) => (
                <li key={x.service_code} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="w-28 shrink-0 font-mono text-xs font-semibold text-navy">{x.service_code}</span>
                  <span className="min-w-0 flex-1 text-ink">{x.name}</span>
                  <span className="text-xs text-muted">{x.family}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={`Treinamentos EAD (${s.data.courses.length})`}>
            <ul className="divide-y divide-line text-sm">
              {s.data.courses.map((c) => (
                <li key={c.course_code} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="w-28 shrink-0 font-mono text-xs font-semibold text-navy">{c.course_code}</span>
                  <span className="min-w-0 flex-1 text-ink">{c.title}</span>
                  <span className="text-xs text-muted">
                    {c.version_label ? `v${c.version_label}` : "sem versão publicada"} · {c.price === null ? "preço PENDENTE" : Number(c.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={`Ainda não liberados — não orçar (${pending.length})`}>
            <ul className="divide-y divide-line text-sm">
              {pending.map((x) => (
                <li key={x.service_code} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="w-28 shrink-0 font-mono text-xs font-semibold text-muted">{x.service_code}</span>
                  <span className="min-w-0 flex-1 text-ink">{x.name}</span>
                  <span className="text-xs text-muted">{COMMERCIAL_STATUS[x.commercial_status]?.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card title="Situação">
            {s.vigente ? (
              <p className="text-sm text-ink">
                Vigente: <strong>{s.vigente.revision}</strong>, aprovada por {s.vigente.approved_by} em {formatDay(s.vigente.approved_on)}.
              </p>
            ) : (
              <p className="text-sm text-ink">Ainda não há revisão vigente.</p>
            )}
            <div className="mt-3" data-testid="master-list-status">
              {s.upToDate ? (
                <Alert kind="info">A revisão vigente está igual ao catálogo atual.</Alert>
              ) : (
                <Alert kind="warning">
                  {s.vigente ? `O catálogo mudou desde a ${s.vigente.revision}.` : "A lista ainda não foi publicada."} Confira e aprove a{" "}
                  {s.nextRevision}.
                </Alert>
              )}
            </div>
            {!s.upToDate && s.changes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">O que mudou</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                  {s.changes.slice(0, 30).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href={withBase("/biblioteca/lista-mestra/previa")}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline"
            >
              <Download size={15} /> Baixar prévia em Word
            </a>
          </Card>
          {warnings.length > 0 && (
            <Card title={`Pontos de atenção para orçar (${warnings.length})`}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink" data-testid="master-list-warnings">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Decisões de liberação e preço são do Diretor, em Configurações → Catálogo de serviços e em Treinamentos.
              </p>
            </Card>
          )}
          {!s.upToDate && (
            <Card title={`Aprovar a ${s.nextRevision}`}>
              <PublishMasterListForm revision={s.nextRevision} defaultName={me.fullName} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
