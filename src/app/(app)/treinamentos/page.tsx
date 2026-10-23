import Link from "next/link";
import { FileArchive, GraduationCap, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page";
import { ButtonLink, CodeBadge } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatBRL } from "@/lib/pricing/engine";
import { formatMinutes, VERSION_STATUS } from "@/lib/training/labels";
import { listCourses } from "@/lib/training/queries";

export const metadata = { title: "Treinamentos" };

export default async function TreinamentosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAppUser(ADMIN_ONLY);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const { rows, error } = await listCourses(q);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Treinamentos"
          description="Cursos EAD da AUDITA: ficha técnica, módulos (Apostila → Videoaula → Avaliação) e materiais do aluno e da equipe, com versões preservadas."
        />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/treinamentos/importar" variant="secondary">
            <FileArchive size={16} /> Importar pacote (.zip)
          </ButtonLink>
          <ButtonLink href="/treinamentos/novo">
            <Plus size={16} /> Novo treinamento
          </ButtonLink>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <label className="min-w-0 flex-1 basis-64">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Código (L01…) ou título"
              className="w-full rounded-md border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
          </span>
        </label>
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-navy/40">
          Pesquisar
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível carregar os treinamentos.
        </p>
      ) : rows.length === 0 ? (
        <section className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
          <GraduationCap className="mx-auto text-green-dark" size={32} aria-hidden />
          <p className="mt-3 text-sm font-semibold text-ink">{q ? "Nenhum treinamento encontrado." : "Nenhum treinamento cadastrado ainda."}</p>
          {!q && <p className="mt-1 text-sm text-muted">Comece pelo L01: cadastre o código, o título e a versão do material.</p>}
        </section>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="training-list">
          {rows.map((c) => {
            const draft = c.training_versions.find((v) => v.status === "rascunho");
            const pub = c.training_versions.find((v) => v.status === "publicada");
            const shown = pub ?? draft;
            return (
              <li key={c.id}>
                <Link
                  href={`/treinamentos/${c.id}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-line bg-white p-5 transition hover:border-navy/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <CodeBadge code={c.course_code} />
                    {pub && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERSION_STATUS.publicada.cls}`}>Publicada v{pub.version_label}</span>
                    )}
                    {draft && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERSION_STATUS.rascunho.cls}`}>Rascunho v{draft.version_label}</span>
                    )}
                    {c.status === "inativo" && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">Inativo</span>}
                  </div>
                  <span className="text-base font-semibold leading-snug text-ink">{c.title}</span>
                  <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{shown?.workload_minutes ? formatMinutes(shown.workload_minutes) : "Carga horária a definir"}</span>
                    <span>{c.price === null ? "Preço PENDENTE" : formatBRL(c.price)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
