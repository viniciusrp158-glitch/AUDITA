import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Alert, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page";
import { ParamStatusPill } from "@/components/pricing-status";
import { TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatDateTime, formatDay } from "@/lib/format";
import { costPerHour, formatBRL, formatPercent } from "@/lib/pricing/engine";
import { PARAM_FIELDS } from "@/lib/pricing/labels";
import { listParameterSets } from "@/lib/pricing/queries";
import { toEngineParams } from "@/lib/pricing/quote";
import { createParameterDraftAction } from "./actions";

export const metadata = { title: "Parâmetros financeiros" };

export default async function ParametrosPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const sets = await listParameterSets();
  const vigente = sets.find((s) => s.status === "vigente");
  const draft = sets.find((s) => s.status === "rascunho");

  return (
    <>
      <Link href="/configuracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Configurações
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Parâmetros financeiros"
          description="Aba “Parâmetros” do AUDDOC011-ANX01, em versões. A versão vigente é usada nos novos orçamentos e não pode ser alterada; mudanças geram nova versão."
        />
        {draft ? (
          <Link
            href={`/configuracoes/parametros/${draft.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Continuar rascunho (versão {draft.version})
          </Link>
        ) : (
          <form action={createParameterDraftAction}>
            <SubmitButton pendingText="Criando…" full={false}>
              <span className="inline-flex items-center gap-2">
                <Plus size={16} /> Nova versão
              </span>
            </SubmitButton>
          </form>
        )}
      </div>

      {sp.erro && <div className="mb-4"><Alert kind="error">Não foi possível criar a nova versão.</Alert></div>}

      {!vigente && (
        <div className="mb-4">
          <Alert kind="warning">
            Nenhuma versão vigente. Sem parâmetros aprovados, todos os orçamentos ficam em <strong>PENDENTE: CUSTOS / PARÂMETROS</strong> e
            nenhum preço é calculado (AUDDOC017 CA-05).
          </Alert>
        </div>
      )}

      {sets.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">Nenhuma versão cadastrada.</p>
      ) : (
        <ul className="space-y-3">
          {sets.map((s) => {
            const cph = costPerHour(toEngineParams(s));
            const filled = PARAM_FIELDS.filter((f) => s[f.key] !== null).length;
            return (
              <li key={s.id}>
                <Link
                  href={`/configuracoes/parametros/${s.id}`}
                  className="block rounded-xl border border-line bg-white p-4 transition hover:border-navy/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">Versão {s.version}</span>
                    <ParamStatusPill status={s.status} />
                    {s.is_test && <TestBadge />}
                  </div>
                  <p className="mt-1 break-words text-sm font-semibold text-ink">{s.label}</p>
                  <p className="mt-1 text-xs text-muted">
                    Custo/hora {cph ? formatBRL(cph) : "PENDENTE"} · margem-alvo {formatPercent(s.target_margin)} · {filled}/{PARAM_FIELDS.length}{" "}
                    campos preenchidos
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.published_at ? `Publicada em ${formatDateTime(s.published_at)}` : `Atualizada em ${formatDateTime(s.updated_at)}`}
                    {s.reference_date ? ` · referência ${formatDay(s.reference_date)}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
