import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { ButtonLink } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { PHASES, type Phase } from "@/lib/library/labels";
import { currentRevision, listLibrary } from "@/lib/library/queries";
import { LibraryList } from "./library-list";

export const metadata = { title: "Biblioteca" };

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ q?: string; fase?: string; familia?: string }> }) {
  await requireAppUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const fase = Object.keys(PHASES).includes(sp.fase ?? "") ? (sp.fase as Phase) : "";
  const familia = (sp.familia ?? "").slice(0, 80);
  const { rows, families, error } = await listLibrary({ q, fase, familia });
  const vigentes = rows.filter((d) => d.library_revisions.some((r) => r.status === "vigente")).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Biblioteca"
          description="Documentos oficiais AUDDOC e anexos aprovados, com revisões preservadas. Arquivos privados, baixados por link temporário."
        />
        <ButtonLink href="/biblioteca/novo">
          <Plus size={16} /> Novo documento
        </ButtonLink>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <label className="min-w-0 flex-1 basis-64">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Código (AUDDOC010…), título ou família"
              className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </span>
        </label>
        <label className="min-w-0 flex-1 basis-44 sm:flex-none">
          <span className="sr-only">Fase</span>
          <select name="fase" defaultValue={fase} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
            <option value="">Todas as fases</option>
            {(Object.keys(PHASES) as Phase[]).map((k) => (
              <option key={k} value={k}>
                {PHASES[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 basis-44 sm:flex-none">
          <span className="sr-only">Família</span>
          <select name="familia" defaultValue={familia} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy">
            <option value="">Todas as famílias</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Filtrar
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível carregar a biblioteca.
        </p>
      ) : (
        <>
          <LibraryList
            expandAll={Boolean(q)}
            rows={rows.map((d) => {
              const r = currentRevision(d);
              return {
                id: d.id,
                doc_code: d.doc_code,
                title: d.title,
                family: d.family,
                parent_id: d.parent_id,
                approved_on: r?.approved_on ?? null,
                revision: r?.revision ?? null,
                status: r?.status ?? null,
                inactive: d.status === "inativo",
              };
            })}
          />

          {rows.length === 0 && (
            <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">
              {q || fase || familia ? "Nenhum documento encontrado." : "Nenhum documento cadastrado."}
            </p>
          )}
          <p className="mt-4 text-sm text-muted">
            {rows.length} documento{rows.length === 1 ? "" : "s"} · {vigentes} com revisão vigente
          </p>
        </>
      )}
    </>
  );
}
