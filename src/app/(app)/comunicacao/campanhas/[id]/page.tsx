import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/comunicacao/labels";
import { getCampaignOr404, listPieces } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";
import { updateCampaignAction } from "../../actions";
import { CampaignForm } from "../../comm-forms";
import { CampaignStatusPill, PieceStatusPill } from "../../shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCampaignOr404(id);
  return { title: `Campanha ${c.campaign_code}` };
}

export default async function CampanhaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  await requireAppUser(COMMUNICATE);
  const { id } = await params;
  const sp = await searchParams;
  const c = await getCampaignOr404(id);
  const pieces = await listPieces({ campaign: id });
  return (
    <>
      <Link href="/comunicacao/campanhas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Campanhas
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">{c.campaign_code}</span>
          <CampaignStatusPill status={c.status} />
          {c.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-ink">{c.name}</h1>
      </header>
      <div className="space-y-6">
        {sp.criada && <Alert kind="info">Campanha criada. Vincule peças a ela no briefing de cada peça.</Alert>}
        <Card title={`Peças (${pieces.length})`}>
          {pieces.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma peça vinculada.{" "}
              <Link href="/comunicacao/pecas/nova" className="font-semibold text-navy underline">
                Criar peça
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {pieces.map((p) => (
                <li key={p.id}>
                  <Link href={`/comunicacao/pecas/${p.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm hover:border-navy/40">
                    <span className="font-mono text-xs font-semibold text-navy">{p.piece_code}</span>
                    <PieceStatusPill status={p.status} />
                    <span className="min-w-0 break-words text-ink">{p.title || p.theme}</span>
                    <span className="text-xs text-muted">{TEMPLATES[p.template].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Dados da campanha">
          <CampaignForm
            action={updateCampaignAction.bind(null, c.id)}
            initial={{
              name: c.name,
              objective: c.objective ?? "",
              audience: c.audience ?? "",
              starts_on: c.starts_on ?? "",
              ends_on: c.ends_on ?? "",
              status: c.status,
              notes: c.notes ?? "",
            }}
            button="Salvar campanha"
          />
        </Card>
      </div>
    </>
  );
}
