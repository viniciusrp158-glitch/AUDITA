import Link from "next/link";
import { Download, List, SquareKanban } from "lucide-react";
import { withBase } from "@/lib/base-path";

/** Quadro em colunas por etapa (Frente A, A7) — o mesmo desenho do funil da prospecção, usado em Demandas e Orçamentos.
 *  No celular as colunas rolam para o lado dentro do quadro, sem rolar a página. */
export function Board({
  columns,
  max = 60,
  moreHint = "use a pesquisa para encontrar",
}: {
  columns: { key: string; label: string; items: { id: string; node: React.ReactNode }[] }[];
  max?: number;
  moreHint?: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8" data-testid="quadro">
      <div className="flex min-w-max items-start gap-3">
        {columns.map((c) => (
          <section key={c.key} aria-label={c.label} className="w-64 shrink-0 rounded-xl bg-surface p-2.5">
            <header className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-ink">{c.label}</h2>
              <span className="rounded-full bg-white px-2 text-xs font-bold tabular-nums text-ink">{c.items.length}</span>
            </header>
            <ul className="space-y-2">
              {c.items.slice(0, max).map((i) => (
                <li key={i.id}>{i.node}</li>
              ))}
              {c.items.length === 0 && <li className="px-1 py-2 text-xs text-muted">Nenhum item</li>}
              {c.items.length > max && (
                <li className="px-1 text-xs text-muted">
                  + {c.items.length - max} — {moreHint}
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Classe do cartão do quadro. */
export const BOARD_CARD = "block rounded-lg border border-line bg-white p-3 transition hover:border-navy/40";

/** Alternância Lista | Quadro (mantém os demais filtros). */
export function ViewToggle({ board, listHref, boardHref }: { board: boolean; listHref: string; boardHref: string }) {
  const cls = (on: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 text-sm ${on ? "bg-navy font-semibold text-white" : "bg-white text-muted hover:text-navy"}`;
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line" role="group" aria-label="Forma de exibição">
      <Link href={listHref} className={cls(!board)} aria-current={!board ? "page" : undefined}>
        <List size={15} /> Lista
      </Link>
      <Link href={boardHref} className={`${cls(board)} border-l border-line`} aria-current={board ? "page" : undefined}>
        <SquareKanban size={15} /> Quadro
      </Link>
    </div>
  );
}

/** Botão de exportar CSV: link comum (download de arquivo, não navegação do Next), com o prefixo /empresa. */
export function ExportLink({ href }: { href: string }) {
  return (
    <a
      href={withBase(href)}
      download
      className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-navy/40"
      title="Baixa a lista com os filtros atuais em planilha (CSV, até 1000 linhas)"
    >
      <Download size={16} /> Exportar
    </a>
  );
}
