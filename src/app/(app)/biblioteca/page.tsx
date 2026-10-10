import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { LibStatusPill } from "@/components/library-status";
import { PageHeader } from "@/components/page";
import { ButtonLink } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDay } from "@/lib/format";
import { PHASES, type Phase } from "@/lib/library/labels";
import { currentRevision, listLibrary, type LibDocument } from "@/lib/library/queries";

export const metadata = { title: "Biblioteca" };

function Situation({ d }: { d: LibDocument }) {
  const r = currentRevision(d);
  if (!r) return <span className="text-xs text-muted">Sem arquivo</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-xs text-ink">{r.revision}</span>
      <LibStatusPill status={r.status} />
      {d.status === "inativo" && <span className="text-xs text-muted">(inativo)</span>}
    </span>
  );
}

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ q?: string; fase?: string; familia?: string }> }) {
  await requireAppUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const fase = Object.keys(PHASES).includes(sp.fase ?? "") ? (sp.fase as Phase) : "";
  const familia = (sp.familia ?? "").slice(0, 80);
  const { rows, families, error } = await listLibrary({ q, fase, familia });
  // Anexos logo abaixo do documento principal
  const ordered = rows.filter((d) => !d.parent_id || !rows.some((p) => p.id === d.parent_id));
  const withAnnexes = ordered.flatMap((d) => [d, ...rows.filter((a) => a.parent_id === d.id)]);
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
          <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Título</th>
                  <th className="px-4 py-2.5 font-semibold">Família</th>
                  <th className="px-4 py-2.5 font-semibold">Aprovação</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {withAnnexes.map((d) => {
                  const r = currentRevision(d);
                  return (
                    <tr key={d.id} className="align-top hover:bg-surface/60">
                      <td className={`whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-navy ${d.parent_id ? "pl-8" : ""}`}>{d.doc_code}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/biblioteca/${d.id}`} className="font-medium text-ink hover:text-navy hover:underline">
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{d.family}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">{formatDay(r?.approved_on) || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Situation d={d} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {withAnnexes.map((d) => (
              <li key={d.id} className={d.parent_id ? "pl-4" : ""}>
                <Link href={`/biblioteca/${d.id}`} className="block rounded-xl border border-line bg-white p-3 active:bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">{d.doc_code}</span>
                    <Situation d={d} />
                  </div>
                  <p className="mt-1 break-words text-sm font-medium text-ink">{d.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{d.family}</p>
                </Link>
              </li>
            ))}
          </ul>

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
