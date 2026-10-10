import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Alert, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ESSENTIAL_FIELDS, pendingEssentials } from "@/lib/institutional";
import { listInstitutionalProfiles } from "@/lib/institutional-queries";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createInstitutionalDraftAction } from "./actions";
import { InstitutionalStatusPill, ProposalPreview } from "./shared";

export const metadata = { title: "Dados institucionais" };

export default async function InstitucionalPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const list = await listInstitutionalProfiles();
  const vigente = list.find((p) => p.status === "vigente") ?? null;
  const draft = list.find((p) => p.status === "rascunho");
  const pending = pendingEssentials(vigente);

  return (
    <>
      <Link
        href="/configuracoes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy"
      >
        <ArrowLeft size={16} /> Configurações
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Dados institucionais"
          description="Razão social, CNPJ, endereço e contatos da AUDITA usados como “Empresa proponente” nas propostas. Em versões: a vigente vale para as novas revisões; mudanças geram nova versão."
        />
        <div className="mb-6 sm:mb-0">
          {draft ? (
            <Link
              href={`/configuracoes/institucional/${draft.id}`}
              className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              Continuar rascunho (versão {draft.version})
            </Link>
          ) : (
            <form action={createInstitutionalDraftAction}>
              <SubmitButton pendingText="Criando…" full={false}>
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} />{" "}
                  {vigente ? "Nova versão" : "Preencher dados"}
                </span>
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {sp.erro && (
        <div className="mb-4">
          <Alert kind="error">Não foi possível criar a nova versão.</Alert>
        </div>
      )}

      <div className="space-y-6">
        <div data-testid="institutional-status">
          {!vigente ? (
            <Alert kind="warning">
              Nenhuma versão publicada. As propostas saem com “AUDITA — razão
              social e CNPJ pendentes de formalização” (AUDDOC010 §7). Os dados
              vêm do caderno de pendências (C1 — contabilidade; D6 — Diretor).
            </Alert>
          ) : pending.length > 0 ? (
            <Alert kind="warning">
              Versão {vigente.version} vigente com {pending.length} de{" "}
              {ESSENTIAL_FIELDS.length} dados essenciais PENDENTES:{" "}
              {pending.map((f) => f.label).join(", ")}.
            </Alert>
          ) : (
            <Alert kind="info">
              Versão {vigente.version} vigente com todos os dados essenciais
              preenchidos.
            </Alert>
          )}
        </div>

        <Card title="Como aparece nas propostas">
          <ProposalPreview p={vigente} />
        </Card>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Versões</h2>
          {list.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
              Nenhuma versão cadastrada.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="institutional-versions">
              {list.map((p) => {
                const miss = pendingEssentials(p).length;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/configuracoes/institucional/${p.id}`}
                      className="block rounded-xl border border-line bg-white p-4 transition hover:border-navy/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-navy">
                          Versão {p.version}
                        </span>
                        <InstitutionalStatusPill status={p.status} />
                        {p.is_test && <TestBadge />}
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold text-ink">
                        {p.legal_name ?? "Razão social PENDENTE"}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {ESSENTIAL_FIELDS.length - miss}/
                        {ESSENTIAL_FIELDS.length} dados essenciais ·{" "}
                        {p.published_at
                          ? `publicada em ${formatDateTime(p.published_at)}`
                          : `atualizada em ${formatDateTime(p.updated_at)}`}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
