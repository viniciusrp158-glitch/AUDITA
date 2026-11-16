import { catalog } from "@/lib/vitrine";
import { PublicPage } from "../loja";
import { AVISO_LIVRE, CursoCard, CursoDestaque } from "../vitrine-ui";
import { FiltroCursos } from "./filtro";

export const metadata = { title: "Cursos", robots: { index: true, follow: true } };
export const dynamic = "force-dynamic";

/** Catálogo da Audita Academy. Com até dois cursos, cada um aparece em destaque grande; a busca aparece a partir de quatro. */
export default async function CursosPage() {
  const c = await catalog();
  const cursos = c?.aberta ? c.cursos : [];
  return (
    <PublicPage>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6">
          <p className="text-sm font-semibold tracking-[0.08em] text-green uppercase">Audita Academy</p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl leading-tight font-extrabold text-balance sm:text-[42px]">
            Cursos de segurança e saúde no trabalho, no seu ritmo
          </h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Apostila, videoaula e avaliação com retorno comentado em cada módulo. Certificado de curso livre com código de verificação.
          </p>
        </div>
      </section>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        {cursos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted" data-testid="store-closed">
            As inscrições abrem em breve.
          </p>
        ) : cursos.length <= 2 ? (
          <div className="flex flex-col gap-6" data-testid="store-list">
            {cursos.map((k) => (
              <CursoDestaque key={k.code} c={k} />
            ))}
          </div>
        ) : cursos.length < 4 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="store-list">
            {cursos.map((k) => (
              <CursoCard key={k.code} c={k} />
            ))}
          </ul>
        ) : (
          <FiltroCursos>
            {cursos.map((k) => (
              <CursoCard key={k.code} c={k} />
            ))}
          </FiltroCursos>
        )}
        <p className="text-sm text-muted">{AVISO_LIVRE}</p>
      </main>
    </PublicPage>
  );
}
