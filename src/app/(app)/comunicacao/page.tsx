import Link from "next/link";
import { Plus } from "lucide-react";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { BRANDS, CHANNELS, PIECE_STATUS, TEMPLATES, type PieceStatus } from "@/lib/comunicacao/labels";
import { approvedLogo, listPieces } from "@/lib/comunicacao/queries";
import { formatDateTime } from "@/lib/format";
import { COMMUNICATE } from "@/lib/permissions";
import { CommTabs, NoAiNotice, PieceStatusPill } from "./shared";

export const metadata = { title: "Comunicação" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  ...(Object.keys(PIECE_STATUS) as PieceStatus[]).map((s) => ({ value: s, label: PIECE_STATUS[s].label })),
];

export default async function ComunicacaoPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const user = await requireAppUser(COMMUNICATE);
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.value === sp.situacao) ? (sp.situacao ?? "") : "";
  const [all, logo] = await Promise.all([listPieces(), approvedLogo("audita")]);
  const pieces = status ? all.filter((p) => p.status === status) : all;
  const count = (s: PieceStatus) => all.filter((p) => p.status === s).length;
  const isAdmin = user.role === "admin";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Comunicação"
          description="Peças institucionais e de marketing com a identidade do AUDDOC003: modelo → briefing → texto → revisão de marca e texto → exportação autorizada (FL-04)."
        />
        <Link
          href="/comunicacao/pecas/nova"
          className="mb-6 inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 sm:mb-0"
        >
          <Plus size={16} aria-hidden /> Nova peça
        </Link>
      </div>
      <CommTabs active="/comunicacao" />

      <div className="space-y-4">
        {!logo && (
          <Alert kind="warning">
            Logo oficial da AUDITA ainda sem versão aprovada na biblioteca de marca. As prévias mostram “LOGO OFICIAL PENDENTE” e nenhuma peça
            pode ser aprovada até lá.{" "}
            {isAdmin ? (
              <Link href="/comunicacao/marca" className="font-semibold underline">
                Enviar e aprovar o arquivo oficial
              </Link>
            ) : (
              "Aguarde o administrador enviar o arquivo oficial."
            )}
          </Alert>
        )}
        {isAdmin && count("em_revisao") > 0 && (
          <Alert kind="info">
            {count("em_revisao")} peça(s) aguardando a sua revisão.{" "}
            <Link href="/comunicacao?situacao=em_revisao" className="font-semibold underline">
              Ver
            </Link>
          </Alert>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="comm-counters">
          {(["rascunho", "em_revisao", "aprovada", "cancelada"] as PieceStatus[]).map((s) => (
            <div key={s} className="rounded-xl border border-line bg-white p-3">
              <dt className="text-xs font-medium text-muted">{PIECE_STATUS[s].label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-ink">{count(s)}</dd>
            </div>
          ))}
        </dl>

        <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value || "todas"}
              href={f.value ? `/comunicacao?situacao=${f.value}` : "/comunicacao"}
              aria-current={status === f.value ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                status === f.value ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:border-navy/40"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {pieces.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
            Nenhuma peça {status ? "nesta situação" : "cadastrada"}. Comece por “Nova peça”.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="pieces-list">
            {pieces.map((p) => (
              <li key={p.id}>
                <Link href={`/comunicacao/pecas/${p.id}`} className="block rounded-xl border border-line bg-white p-4 transition hover:border-navy/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">{p.piece_code}</span>
                    <PieceStatusPill status={p.status} />
                    {p.is_test && <TestBadge />}
                  </div>
                  <p className="mt-1 break-words text-sm font-semibold text-ink">{p.title || p.theme}</p>
                  <p className="mt-1 text-xs text-muted">
                    {TEMPLATES[p.template].label} · {BRANDS[p.brand].label} · {CHANNELS[p.channel]}
                    {p.current_version ? ` · versão ${p.current_version}` : ""} · atualizada em {formatDateTime(p.updated_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <NoAiNotice />
      </div>
    </>
  );
}
