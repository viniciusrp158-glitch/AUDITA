import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { listCampaigns, listServiceOptions } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";
import { createPieceAction } from "../../actions";
import { NewPieceForm } from "../../comm-forms";
import { NoAiNotice } from "../../shared";

export const metadata = { title: "Nova peça" };

export default async function NovaPecaPage() {
  await requireAppUser(COMMUNICATE);
  const [services, campaigns] = await Promise.all([listServiceOptions(), listCampaigns()]);
  return (
    <>
      <Link href="/comunicacao" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Comunicação
      </Link>
      <PageHeader title="Nova peça" description="1. Modelo e briefing (tema, objetivo, público, canal e serviço). Depois você escreve o texto e vê a prévia." />
      <div className="space-y-4">
        <Card title="Briefing">
          <NewPieceForm
            action={createPieceAction}
            opts={{ services, campaigns: campaigns.filter((c) => c.status !== "cancelada" && c.status !== "encerrada") }}
          />
        </Card>
        <NoAiNotice />
      </div>
    </>
  );
}
