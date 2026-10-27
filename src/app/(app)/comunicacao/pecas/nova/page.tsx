import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Alert } from "@/components/form";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/comunicacao/ai";
import { listCampaigns, listServiceOptions } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";
import { createPieceAction } from "../../actions";
import { NewPieceForm } from "../../comm-forms";
import { NewAiPieceForm } from "../../ia-forms";
import { AiNotice } from "../../shared";

export const metadata = { title: "Nova peça" };

export default async function NovaPecaPage() {
  await requireAppUser(COMMUNICATE);
  const [services, campaigns] = await Promise.all([listServiceOptions(), listCampaigns()]);
  return (
    <>
      <Link href="/comunicacao" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Comunicação
      </Link>
      <PageHeader title="Nova peça" description="Descreva a arte e deixe a IA desenhar no estilo da marca, ou preencha o briefing e escreva o texto no layout padrão." />
      <div className="space-y-4">
        <Card title="Criar com IA">
          {aiConfigured() ? (
            <NewAiPieceForm opts={{ services, campaigns: campaigns.filter((c) => c.status !== "cancelada" && c.status !== "encerrada") }} />
          ) : (
            <Alert kind="warning">
              A IA ainda não está ligada neste servidor: falta cadastrar a chave da Anthropic (ANTHROPIC_API_KEY) no arquivo de configuração do
              sistema. Use o briefing abaixo enquanto isso.
            </Alert>
          )}
        </Card>
        <Card title="Ou: briefing e texto no layout padrão">
          <NewPieceForm
            action={createPieceAction}
            opts={{ services, campaigns: campaigns.filter((c) => c.status !== "cancelada" && c.status !== "encerrada") }}
          />
        </Card>
        <AiNotice />
      </div>
    </>
  );
}
