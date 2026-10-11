import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ASSET_VARIANTS, BRANDS } from "@/lib/comunicacao/labels";
import { getBrandAssetOr404 } from "@/lib/comunicacao/queries";
import { formatDateTime } from "@/lib/format";
import { formatBytes } from "@/lib/library/labels";
import { COMMUNICATE } from "@/lib/permissions";
import { approveBrandVersionAction, cancelBrandVersionAction, setAssetStatusAction } from "../../actions";
import { ApproveBrandForm, BrandUploadForm, ReasonForm } from "../../comm-forms";
import { AssetStatusPill } from "../../shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getBrandAssetOr404(id);
  return { title: a.title };
}

const ACCEPT: Record<string, string> = {
  original_png: ".png",
  png_transparente: ".png",
  vetor: ".svg",
  pdf_vetorial: ".pdf",
  aplicacao: ".png,.jpg,.jpeg,.pdf",
  outro: ".png,.jpg,.jpeg,.svg,.pdf",
};

export default async function AtivoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAppUser(COMMUNICATE);
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const sp = await searchParams;
  const a = await getBrandAssetOr404(id);
  return (
    <>
      <Link href="/comunicacao/marca" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Biblioteca de marca
      </Link>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {BRANDS[a.brand].label} · {ASSET_VARIANTS[a.variant].label}
          {a.status === "inativo" ? " · inativo" : ""}
        </p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-ink">{a.title}</h1>
        <p className="mt-1 text-sm text-muted">{ASSET_VARIANTS[a.variant].hint}</p>
      </header>
      <div className="space-y-6">
        {sp.criado && <Alert kind="info">Ativo cadastrado. Envie o arquivo oficial abaixo.</Alert>}
        {sp.aprovada && <Alert kind="info">Versão aprovada. A anterior (se havia) ficou como substituída e continua no histórico.</Alert>}
        {sp.cancelada && <Alert kind="info">Versão cancelada.</Alert>}

        <Card title="Versões">
          {a.versions.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma versão {isAdmin ? "enviada" : "aprovada"}.</p>
          ) : (
            <ul className="space-y-4" data-testid="asset-versions">
              {a.versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-start gap-4">
                    {/^image\/(png|jpeg)$/.test(v.mime_type) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/comunicacao/marca/${a.id}/arquivo/${v.id}`} alt={`Versão ${v.version}`} className="h-24 w-40 rounded border border-line bg-white object-contain" />
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">Versão {v.version}</span>
                        <AssetStatusPill status={v.status} />
                        {v.is_test && <TestBadge />}
                      </div>
                      <p className="mt-1 break-all text-xs text-muted">
                        {v.original_name} · {formatBytes(v.size_bytes)}
                        {v.width ? ` · ${v.width}×${v.height} px` : ""} · SHA-256 {v.sha256.slice(0, 16)}…
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Origem: {v.source_note} · enviada em {formatDateTime(v.created_at)}
                        {v.approved_at ? ` · aprovada em ${formatDateTime(v.approved_at)}` : ""}
                      </p>
                      {v.status_note && <p className="mt-0.5 text-xs text-ink">“{v.status_note}”</p>}
                      <a href={`/comunicacao/marca/${a.id}/arquivo/${v.id}?baixar=1`} className="mt-2 inline-block text-xs font-semibold text-navy underline">
                        Baixar arquivo original
                      </a>
                    </div>
                  </div>
                  {isAdmin && v.status === "rascunho" && (
                    <div className="mt-3 grid gap-4 border-t border-line pt-3 lg:grid-cols-2">
                      <ApproveBrandForm action={approveBrandVersionAction.bind(null, a.id, v.id)} />
                      <ReasonForm action={cancelBrandVersionAction.bind(null, a.id, v.id)} label="Cancelar (motivo)" button="Cancelar versão" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isAdmin && a.status === "ativo" && (
          <Card title="Enviar nova versão">
            <BrandUploadForm assetId={a.id} accept={ACCEPT[a.variant]} />
            <p className="mt-2 text-xs text-muted">O arquivo é guardado exatamente como enviado (sem compressão ou recorte) e conferido pelo SHA-256.</p>
          </Card>
        )}
        {isAdmin && (
          <form action={setAssetStatusAction.bind(null, a.id, a.status === "ativo" ? "inativo" : "ativo")}>
            <button type="submit" className="text-xs font-semibold text-muted underline hover:text-navy">
              {a.status === "ativo" ? "Inativar ativo (deixa de ser usado nas peças; o histórico continua)" : "Reativar ativo"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
