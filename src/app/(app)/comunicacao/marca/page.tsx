import Link from "next/link";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card, TestBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ASSET_VARIANTS, BRAND_KEYS, BRANDS, PALETTE, SIGNATURE, SLOGAN } from "@/lib/comunicacao/labels";
import { listBrandAssets } from "@/lib/comunicacao/queries";
import { COMMUNICATE } from "@/lib/permissions";
import { createAssetAction } from "../actions";
import { AssetForm } from "../comm-forms";
import { AssetStatusPill, CommTabs } from "../shared";

export const metadata = { title: "Biblioteca de marca" };

const SWATCHES = [
  { name: "Azul-marinho", hex: PALETTE.navy, use: "Base institucional: títulos, textos e linhas." },
  { name: "Verde AUDITA", hex: PALETTE.green, use: "Folha da marca, acentos e destaques pontuais." },
  { name: "Azul PRO", hex: PALETTE.pro, use: "Identidade do Audita PRO." },
  { name: "Verde HUB", hex: PALETTE.hub, use: "Identidade do Audita HUB." },
  { name: "Cinza claro", hex: PALETTE.light, use: "Fundos auxiliares e tabelas." },
  { name: "Cinza secundário", hex: PALETTE.gray, use: "Legendas." },
];

export default async function MarcaPage() {
  const user = await requireAppUser(COMMUNICATE);
  const isAdmin = user.role === "admin";
  const assets = await listBrandAssets();
  return (
    <>
      <PageHeader
        title="Comunicação"
        description="Biblioteca oficial de marca (AUDDOC003 §12; AUDDOC017 RF-27): arquivos originais em versões rastreáveis, sem alteração dos desenhos."
      />
      <CommTabs active="/comunicacao/marca" />
      <div className="space-y-6">
        {!isAdmin && <Alert kind="info">Você vê somente as versões aprovadas. O envio e a aprovação de arquivos são feitos pelo administrador.</Alert>}

        {BRAND_KEYS.map((b) => {
          const list = assets.filter((a) => a.brand === b);
          return (
            <Card key={b} title={BRANDS[b].label}>
              {list.length === 0 ? (
                <p className="text-sm text-muted">Nenhum arquivo cadastrado. {b === "audita" ? "As peças ficam com “LOGO OFICIAL PENDENTE” até um PNG oficial ser aprovado." : ""}</p>
              ) : (
                <ul className="space-y-2" data-testid={`assets-${b}`}>
                  {list.map((a) => {
                    const ok = a.versions.find((v) => v.status === "aprovado");
                    const waiting = a.versions.filter((v) => v.status === "rascunho").length;
                    return (
                      <li key={a.id}>
                        <Link href={`/comunicacao/marca/${a.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 hover:border-navy/40">
                          {ok && /^image\/(png|jpeg)$/.test(ok.mime_type) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/comunicacao/marca/${a.id}/arquivo/${ok.id}`} alt="" className="h-12 w-20 rounded border border-line bg-white object-contain" />
                          ) : (
                            <span className="flex h-12 w-20 items-center justify-center rounded border border-dashed border-line text-[10px] text-muted">sem aprovado</span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-semibold text-ink">{a.title}</span>
                            <span className="block text-xs text-muted">
                              {ASSET_VARIANTS[a.variant].label}
                              {a.status === "inativo" ? " · inativo" : ""}
                              {ok ? ` · versão ${ok.version} aprovada` : ""}
                              {isAdmin && waiting ? ` · ${waiting} aguardando aprovação` : ""}
                            </span>
                          </span>
                          {ok && <AssetStatusPill status="aprovado" />}
                          {ok?.is_test && <TestBadge />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}

        <Card title="Paleta e assinatura aprovadas (AUDDOC003 §01 e §03)">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SWATCHES.map((s) => (
              <li key={s.hex} className="flex items-center gap-3">
                <span className="h-10 w-10 shrink-0 rounded-md border border-line" style={{ backgroundColor: s.hex }} aria-hidden />
                <span className="text-sm">
                  <span className="block font-semibold text-ink">
                    {s.name} <span className="font-mono text-xs text-muted">{s.hex}</span>
                  </span>
                  <span className="block text-xs text-muted">{s.use}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink">
            Slogan: “{SLOGAN}” · Assinatura: “{SIGNATURE}” · Tipografia de comunicação: Montserrat (títulos Semibold/Bold).
          </p>
        </Card>

        {isAdmin && (
          <details className="rounded-xl border border-line bg-white" data-testid="new-asset">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">Cadastrar ativo de marca</summary>
            <div className="border-t border-line p-4">
              <p className="mb-3 text-xs text-muted">
                Use os arquivos oficiais fornecidos pela AUDITA — nunca versões refeitas ou capturas de tela (AUDDOC003). Derivados (recorte, transparência,
                vetor) entram como ativos próprios, após conferência.
              </p>
              <AssetForm action={createAssetAction} />
            </div>
          </details>
        )}
      </div>
    </>
  );
}
