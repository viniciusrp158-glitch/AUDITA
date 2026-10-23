import Link from "next/link";
import { brl, catalog, hoursText } from "@/lib/vitrine";
import { PublicPage } from "../loja";

export const metadata = { title: "Cursos", robots: { index: true, follow: true } };
export const dynamic = "force-dynamic";

export default async function CursosPage() {
  const c = await catalog();
  const cursos = c?.aberta ? c.cursos : [];
  return (
    <PublicPage>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6">
          <p className="text-sm font-semibold text-green">AUDITA | SSMA &amp; SGI</p>
          <h1 className="mt-2 max-w-3xl text-3xl leading-tight font-extrabold sm:text-4xl">Cursos de segurança e saúde no trabalho, no seu ritmo</h1>
          <p className="mt-3 max-w-2xl text-white/80">Apostila, videoaula e avaliação com retorno comentado em cada módulo. Certificado de curso livre com código de verificação.</p>
        </div>
      </section>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {cursos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted" data-testid="store-closed">
            As inscrições abrem em breve.
          </p>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2" data-testid="store-list">
            {cursos.map((k) => (
              <li key={k.code} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6">
                <p className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-navy px-2 py-0.5 text-white">{k.code}</span>
                  <span className="rounded-md bg-lime-50 px-2 py-0.5 text-green-dark">Curso livre</span>
                  {hoursText(k.workload_minutes) && <span className="rounded-md bg-surface px-2 py-0.5 text-ink">{hoursText(k.workload_minutes)}</span>}
                  <span className="rounded-md bg-surface px-2 py-0.5 text-ink">{k.modules.length} módulos</span>
                </p>
                <h2 className="text-xl leading-snug font-extrabold text-navy">{k.title}</h2>
                {(k.summary ?? k.general_objective) && <p className="line-clamp-3 text-sm text-ink/80">{k.summary ?? k.general_objective}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-2xl font-extrabold text-navy">{brl(k.price)}</p>
                  <Link href={`/cursos/${k.code}`} className="inline-flex min-h-11 items-center rounded-[10px] bg-green px-5 text-sm font-extrabold text-navy">
                    Ver o curso
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PublicPage>
  );
}
