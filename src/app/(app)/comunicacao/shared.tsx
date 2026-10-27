import Link from "next/link";
import {
  ASSET_VERSION_STATUS,
  CAMPAIGN_STATUS,
  PIECE_STATUS,
  VERSION_STATUS,
  type AssetVersionStatus,
  type CampaignStatus,
  type PieceStatus,
  type VersionStatus,
} from "@/lib/comunicacao/labels";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold";

export function PieceStatusPill({ status }: { status: PieceStatus }) {
  return <span className={`${pill} ${PIECE_STATUS[status].cls}`}>{PIECE_STATUS[status].label}</span>;
}
export function VersionStatusPill({ status }: { status: VersionStatus }) {
  return <span className={`${pill} ${VERSION_STATUS[status].cls}`}>{VERSION_STATUS[status].label}</span>;
}
export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  return <span className={`${pill} ${CAMPAIGN_STATUS[status].cls}`}>{CAMPAIGN_STATUS[status].label}</span>;
}
export function AssetStatusPill({ status }: { status: AssetVersionStatus }) {
  return <span className={`${pill} ${ASSET_VERSION_STATUS[status].cls}`}>{ASSET_VERSION_STATUS[status].label}</span>;
}

const TABS = [
  { href: "/comunicacao", label: "Peças" },
  { href: "/comunicacao/campanhas", label: "Campanhas" },
  { href: "/comunicacao/marca", label: "Biblioteca de marca" },
] as const;

/** Abas do módulo; rolam na horizontal no celular sem empurrar a página. */
export function CommTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Seções de comunicação" className="-mx-1 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.href === active ? "page" : undefined}
              className={`inline-block border-b-2 px-3 py-2 text-sm font-semibold ${
                t.href === active ? "border-navy text-navy" : "border-transparent text-muted hover:text-navy"
              }`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AiNotice() {
  return (
    <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted">
      Artes com IA (Claude, da Anthropic; D-08 decidida pelo Diretor em 27/10/2026): a IA recebe só a descrição da peça, a marca, o formato e o
      serviço escolhido, nunca dados de clientes. O logo oficial e o rodapé são aplicados pelo sistema, e toda peça passa pela revisão do
      administrador antes de exportar. Nada é publicado ou agendado automaticamente.
    </p>
  );
}
