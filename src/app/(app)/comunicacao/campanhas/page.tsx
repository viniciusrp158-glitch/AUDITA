import Link from "next/link";
import { PageHeader } from "@/components/page";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { listCampaigns, listPieces } from "@/lib/comunicacao/queries";
import { formatDay } from "@/lib/format";
import { COMMUNICATE } from "@/lib/permissions";
import { createCampaignAction } from "../actions";
import { CampaignForm } from "../comm-forms";
import { CampaignStatusPill, CommTabs } from "../shared";

export const metadata = { title: "Campanhas" };

export default async function CampanhasPage() {
  await requireAppUser(COMMUNICATE);
  const [campaigns, pieces] = await Promise.all([listCampaigns(), listPieces()]);
  return (
    <>
      <PageHeader title="Comunicação" description="Campanhas agrupam peças com o mesmo objetivo e período (AUDDOC017 RF-25)." />
      <CommTabs active="/comunicacao/campanhas" />
      <div className="space-y-6">
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">Nenhuma campanha cadastrada.</p>
        ) : (
          <ul className="space-y-3" data-testid="campaigns-list">
            {campaigns.map((c) => {
              const n = pieces.filter((p) => p.campaign_id === c.id).length;
              return (
                <li key={c.id}>
                  <Link href={`/comunicacao/campanhas/${c.id}`} className="block rounded-xl border border-line bg-white p-4 transition hover:border-navy/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-navy">{c.campaign_code}</span>
                      <CampaignStatusPill status={c.status} />
                      {c.is_test && <TestBadge />}
                    </div>
                    <p className="mt-1 break-words text-sm font-semibold text-ink">{c.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {n} peça(s){c.starts_on ? ` · de ${formatDay(c.starts_on)}` : ""}
                      {c.ends_on ? ` a ${formatDay(c.ends_on)}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <details className="rounded-xl border border-line bg-white" data-testid="new-campaign">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">Nova campanha</summary>
          <div className="border-t border-line p-4">
            <CampaignForm action={createCampaignAction} initial={{ status: "planejada" }} button="Criar campanha" />
          </div>
        </details>
      </div>
    </>
  );
}
