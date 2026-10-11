import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Alert } from "@/components/form";
import { Card, DefinitionList, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { BRANDS, CHANNELS, TEMPLATES, textWarnings } from "@/lib/comunicacao/labels";
import { getPieceOr404, listCampaigns, listPieceExports, listPieceVersions, listServiceOptions } from "@/lib/comunicacao/queries";
import { formatDateTime } from "@/lib/format";
import { COMMUNICATE } from "@/lib/permissions";
import { cancelPieceAction, reopenPieceAction, reviewPieceAction, submitPieceAction, updatePieceAction } from "../../actions";
import { PieceForm, ReasonForm, ReviewForm, SubmitPieceForm } from "../../comm-forms";
import { NoAiNotice, PieceStatusPill, VersionStatusPill } from "../../shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPieceOr404(id);
  return { title: `Peça ${p.piece_code}` };
}

const FLASH: Record<string, string> = {
  criada: "Peça criada. Escreva o texto, salve e confira a prévia.",
  enviada: "Peça enviada para revisão do administrador.",
  aprovada: "Peça aprovada: exportação liberada e registrada.",
  devolvida: "Peça devolvida para ajuste com a orientação registrada.",
  reaberta: "Peça reaberta. A versão aprovada continua exportável até uma nova ser aprovada.",
  cancelada: "Peça cancelada.",
};

export default async function PecaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAppUser(COMMUNICATE);
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const sp = await searchParams;
  const p = await getPieceOr404(id);
  const [versions, exports, services, campaigns] = await Promise.all([listPieceVersions(id), listPieceExports(id), listServiceOptions(), listCampaigns()]);
  const current = versions.find((v) => v.version === p.current_version) ?? null;
  const approved = versions.find((v) => v.status === "aprovada") ?? null;
  const flash = Object.keys(FLASH).find((k) => sp[k]);
  const t = TEMPLATES[p.template];
  const svc = services.find((s) => s.id === p.service_id);
  const camp = campaigns.find((c) => c.id === p.campaign_id);
  const aspect = `${t.width} / ${t.height}`;

  const initial: Record<string, string> = {
    template: p.template,
    brand: p.brand,
    theme: p.theme,
    objective: p.objective ?? "",
    audience: p.audience ?? "",
    channel: p.channel,
    service_id: p.service_id ?? "",
    campaign_id: p.campaign_id ?? "",
    title: p.title ?? "",
    subtitle: p.subtitle ?? "",
    body: p.body ?? "",
    cta: p.cta ?? "",
    caption: p.caption ?? "",
    show_slogan: p.show_slogan ? "on" : "",
    show_contacts: p.show_contacts ? "on" : "",
  };

  const blockers: string[] = [];
  if (current && p.status === "em_revisao") {
    const s = current.snapshot;
    if (!s.logo) blockers.push("Não há logo oficial aprovado desta marca na biblioteca de marca.");
    if (s.service && s.service.commercial_status !== "apto_comercialmente") blockers.push(`${s.service.service_code} não está liberado comercialmente (AUDDOC004).`);
    if (s.piece.show_contacts && !(s.contacts && (s.contacts.email || s.contacts.phone || s.contacts.website)))
      blockers.push("A peça exibe contatos, mas não há contatos oficiais publicados nos dados institucionais.");
    blockers.push(...textWarnings(s.piece.title, s.piece.subtitle, s.piece.body, s.piece.cta, s.piece.caption).map((w) => `Aviso de texto: ${w}`));
  }

  return (
    <>
      <Link href="/comunicacao" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Comunicação
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-navy">{p.piece_code}</span>
          <PieceStatusPill status={p.status} />
          {p.is_test && <TestBadge />}
        </div>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-ink">{p.title || p.theme}</h1>
        <p className="mt-1 text-sm text-muted">
          {t.label} ({t.size}) · {BRANDS[p.brand].label} · {CHANNELS[p.channel]}
          {camp ? ` · ${camp.campaign_code}` : ""}
        </p>
      </header>

      <div className="space-y-6">
        {flash && <Alert kind="info">{FLASH[flash]}</Alert>}
        {p.status === "rascunho" && p.status_note && (
          <Alert kind="warning">
            <span className="font-semibold">Orientação da revisão:</span> {p.status_note}
          </Alert>
        )}

        <Card title="Briefing">
          <DefinitionList
            items={[
              { label: "Tema", value: p.theme },
              { label: "Objetivo", value: p.objective },
              { label: "Público", value: p.audience },
              { label: "Canal", value: CHANNELS[p.channel] },
              { label: "Serviço divulgado", value: svc ? `${svc.service_code} — ${svc.name}` : null },
              { label: "Campanha", value: camp ? `${camp.campaign_code} — ${camp.name}` : null },
            ]}
          />
        </Card>

        {p.status === "rascunho" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Texto da peça">
              <PieceForm action={updatePieceAction.bind(null, p.id)} initial={initial} opts={{ services, campaigns }} />
            </Card>
            <div className="space-y-6">
              <Card title="Prévia (rascunho salvo)">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/comunicacao/pecas/${p.id}/previa?v=${encodeURIComponent(p.updated_at)}`}
                  alt={`Prévia da peça ${p.piece_code}`}
                  className="w-full rounded-lg border border-line bg-surface"
                  style={{ aspectRatio: aspect }}
                  data-testid="piece-preview"
                />
                <p className="mt-2 text-xs text-muted">A prévia não é exportação: arquivos finais só saem de versões aprovadas.</p>
              </Card>
              <Card title="Enviar para revisão">
                <SubmitPieceForm
                  action={submitPieceAction.bind(null, p.id)}
                  disabled={(p.title ?? "").trim().length < 3 ? "Escreva e salve o título antes de enviar." : undefined}
                />
                <p className="mt-2 text-xs text-muted">O conteúdo enviado fica congelado como uma versão; o administrador revisa marca e texto.</p>
              </Card>
            </div>
          </div>
        )}

        {p.status === "em_revisao" && current && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title={`Versão ${current.version} — enviada em ${formatDateTime(current.submitted_at)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/comunicacao/pecas/${p.id}/versoes/${current.version}/imagem`}
                alt={`Versão ${current.version}`}
                className="w-full rounded-lg border border-line bg-surface"
                style={{ aspectRatio: aspect }}
              />
            </Card>
            <Card title="Revisão de marca e texto">
              {isAdmin ? (
                <ReviewForm action={reviewPieceAction.bind(null, p.id, current.id)} blockers={blockers} />
              ) : (
                <p className="text-sm text-muted">Aguardando a revisão do administrador. Enquanto isso, o conteúdo fica travado.</p>
              )}
            </Card>
          </div>
        )}

        {approved && (
          <Card title={`Versão aprovada — versão ${approved.version}`}>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/comunicacao/pecas/${p.id}/versoes/${approved.version}/imagem`}
                alt={`Versão aprovada ${approved.version}`}
                className="w-full rounded-lg border border-line bg-surface"
                style={{ aspectRatio: aspect }}
              />
              <div className="space-y-4">
                <p className="text-sm text-ink">
                  Aprovada em {approved.reviewed_at ? formatDateTime(approved.reviewed_at) : "—"}
                  {approved.review_note ? ` — “${approved.review_note}”` : ""}.
                </p>
                <div className="flex flex-wrap gap-3" data-testid="export-buttons">
                  {(["png", "pdf"] as const).map((f) => (
                    <a
                      key={f}
                      href={`/comunicacao/pecas/${p.id}/versoes/${approved.version}/exportar?formato=${f}`}
                      className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
                    >
                      <Download size={16} aria-hidden /> Exportar {f.toUpperCase()}
                    </a>
                  ))}
                </div>
                <p className="text-xs text-muted">Cada exportação fica registrada (formato, SHA-256, quem e quando). Nada é publicado pelo sistema.</p>
                {approved.snapshot.piece.caption && (
                  <label className="block text-sm font-medium text-ink">
                    Legenda aprovada (copie e cole na publicação)
                    <textarea readOnly rows={5} defaultValue={approved.snapshot.piece.caption} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" />
                  </label>
                )}
                {p.status === "aprovada" && (
                  <details className="rounded-lg border border-line">
                    <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-navy">Reabrir para nova versão</summary>
                    <div className="border-t border-line p-3">
                      <ReasonForm action={reopenPieceAction.bind(null, p.id)} label="Motivo" button="Reabrir" />
                    </div>
                  </details>
                )}
              </div>
            </div>
          </Card>
        )}

        {versions.length > 0 && (
          <Card title="Histórico de versões">
            <ul className="space-y-2" data-testid="versions">
              {versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">Versão {v.version}</span>
                    <VersionStatusPill status={v.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Enviada em {formatDateTime(v.submitted_at)}
                    {v.reviewed_at ? ` · revisada em ${formatDateTime(v.reviewed_at)}` : ""}
                    {v.snapshot.logo ? ` · logo versão ${v.snapshot.logo.version}` : " · sem logo aprovado"}
                    {v.snapshot.contacts ? ` · contatos dos dados institucionais v${v.snapshot.contacts.profile_version}` : ""}
                  </p>
                  {v.review_note && <p className="mt-1 break-words text-xs text-ink">“{v.review_note}”</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {exports.length > 0 && (
          <Card title="Exportações registradas">
            <ul className="space-y-1 text-xs text-muted" data-testid="exports">
              {exports.map((e) => (
                <li key={e.id} className="break-all">
                  {formatDateTime(e.exported_at)} · {e.format.toUpperCase()} · versão {versions.find((v) => v.id === e.version_id)?.version ?? "?"} · SHA-256{" "}
                  {e.sha256.slice(0, 16)}…
                </li>
              ))}
            </ul>
          </Card>
        )}

        {isAdmin && p.status !== "cancelada" && (
          <details className="rounded-xl border border-line bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-danger">Cancelar peça</summary>
            <div className="border-t border-line p-4">
              <ReasonForm action={cancelPieceAction.bind(null, p.id)} label="Motivo do cancelamento" button="Cancelar peça" danger />
            </div>
          </details>
        )}
        <NoAiNotice />
      </div>
    </>
  );
}
