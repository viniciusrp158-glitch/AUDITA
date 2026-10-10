import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { pendingEssentials, toFormValues } from "@/lib/institutional";
import { getInstitutionalOr404 } from "@/lib/institutional-queries";
import { ADMIN_ONLY } from "@/lib/permissions";
import { publishInstitutionalAction, updateInstitutionalAction } from "../actions";
import { InstitutionalForm, PublishInstitutionalForm } from "../institutional-forms";
import { InstitutionalStatusPill, ProfileView, ProposalPreview } from "../shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getInstitutionalOr404(id);
  return { title: `Dados institucionais — versão ${p.version}` };
}

export default async function InstitucionalVersaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publicada?: string }>;
}) {
  await requireAppUser(ADMIN_ONLY);
  const { id } = await params;
  const sp = await searchParams;
  const p = await getInstitutionalOr404(id);

  return (
    <>
      <Link href="/configuracoes/institucional" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Dados institucionais
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">Versão {p.version}</span>
          <InstitutionalStatusPill status={p.status} />
          {p.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-ink">{p.legal_name ?? "Dados institucionais da AUDITA"}</h1>
      </header>

      {sp.publicada && (
        <div className="mb-4">
          <Alert kind="info">Versão publicada: passa a valer nas novas revisões de propostas.</Alert>
        </div>
      )}

      {p.status === "rascunho" ? (
        <div className="space-y-6">
          <Card title="Editar rascunho">
            <InstitutionalForm action={updateInstitutionalAction.bind(null, p.id)} initial={toFormValues(p)} />
          </Card>
          <Card title="Prévia nas propostas (dados salvos)">
            <ProposalPreview p={p} />
          </Card>
          <Card title="Publicar">
            <PublishInstitutionalForm action={publishInstitutionalAction.bind(null, p.id)} pending={pendingEssentials(p).map((f) => f.label)} />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card title="Dados">
            <ProfileView p={p} />
          </Card>
          <Card title="Como aparece nas propostas">
            <ProposalPreview p={p} />
          </Card>
          <p className="text-xs text-muted">Versões publicadas são imutáveis. Para alterar, crie uma nova versão a partir da lista.</p>
        </div>
      )}
    </>
  );
}
