import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Check, ClipboardCheck, PlayCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { capaDoCurso } from "@/lib/academy";
import { brl, hoursText, storeCourse, type StoreCourse } from "@/lib/vitrine";
import { PublicPage } from "../../loja";
import { Perguntas, SelosCurso } from "../../vitrine-ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const r = await storeCourse(codigo);
  return { title: r?.curso?.title ?? "Curso", robots: { index: true, follow: true } };
}

const mm = (p: number) => String(p).padStart(2, "0");
const sum = (c: StoreCourse, k: "video_minutes" | "reading_minutes" | "activity_minutes") => c.modules.reduce((s, m) => s + (m[k] ?? 0), 0);

/** Página de venda do curso (Audita Academy, etapa 2). Todo o texto vem do cadastro do curso na gestão. */
export default async function CursoVendaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const r = await storeCourse(codigo);
  const c = r?.aberta ? r.curso : null;
  if (!c) notFound();
  const videos = c.modules.filter((m) => m.has_video).length;
  const [v, l, a] = [sum(c, "video_minutes"), sum(c, "reading_minutes"), sum(c, "activity_minutes")];
  const acesso = c.access_days ? `Acesso por ${c.access_days} dias` : "Acesso sem prazo de encerramento";
  const inclui = [
    "Acesso liberado assim que o pagamento é confirmado",
    `${c.modules.length} ${c.modules.length === 1 ? "apostila" : "apostilas"} em PDF${videos ? ` e ${videos} ${videos === 1 ? "videoaula" : "videoaulas"}` : ""}`,
    "Avaliações com retorno comentado",
    "Certificado com código e QR code de verificação",
    acesso,
  ];
  const faq = [
    hoursText(c.workload_minutes) && {
      q: "Quanto tempo leva?",
      a: `São ${hoursText(c.workload_minutes)} de estudo${v || l || a ? ` (${[v && `${v} min de vídeo`, l && `${l} de leitura`, a && `${a} de atividades`].filter(Boolean).join(", ")})` : ""}, no seu ritmo.`,
    },
    {
      q: "Por quanto tempo tenho acesso?",
      a: c.access_days ? `${c.access_days} dias a partir da liberação do acesso.` : "O acesso não tem prazo de encerramento.",
    },
    c.final && {
      q: "Como recebo o certificado?",
      a: `Ele é liberado na plataforma ao concluir os ${c.modules.length} módulos e acertar pelo menos ${c.final.pass_score} das ${c.final.objectives} questões da avaliação final. Cada certificado tem um código que qualquer pessoa pode verificar.`,
    },
    c.final && {
      q: `E se eu não acertar ${c.final.pass_score}?`,
      a: c.final.max_attempts
        ? `O sistema indica os módulos para revisar e você faz uma nova tentativa (até ${c.final.max_attempts} tentativas).`
        : "O sistema indica os módulos para revisar e você faz uma nova tentativa, sem limite de tentativas.",
    },
    {
      q: "Como é o pagamento?",
      a: "Pelo Mercado Pago, com Pix, cartão ou boleto. O acesso é liberado assim que o pagamento é confirmado, e você recebe um e-mail para criar sua senha.",
    },
  ].filter(Boolean) as { q: string; a: string }[];
  const passos = [
    { icon: BookOpen, t: "Apostila", d: "Leitura em PDF, para estudar e consultar quando quiser." },
    { icon: PlayCircle, t: "Videoaula", d: "Uma aula por módulo, com casos práticos." },
    { icon: ClipboardCheck, t: "Avaliação", d: "Questões na plataforma, com cronômetro e retorno comentado." },
    {
      icon: ShieldCheck,
      t: "Certificado",
      d: c.final ? `Ao concluir os módulos e acertar pelo menos ${c.final.pass_score} de ${c.final.objectives} na avaliação final.` : "Ao concluir todos os módulos.",
    },
  ];
  const h2 = "font-display text-2xl font-extrabold text-navy";

  return (
    <PublicPage>
      <section className="relative overflow-hidden bg-navy text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capaDoCurso(c.code)} alt="" className="absolute inset-0 size-full object-cover" />
        <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,27,53,0.96)_0%,rgba(3,27,53,0.85)_60%,rgba(3,27,53,0.6)_100%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 lg:pb-40">
          <Link href="/cursos" className="text-sm text-white/80 underline-offset-4 hover:text-white hover:underline">
            ← Todos os cursos
          </Link>
          <div className="mt-5 flex max-w-[680px] flex-col gap-4">
            <SelosCurso c={c} escuro />
            <h1 className="font-display text-3xl leading-[1.12] font-extrabold text-balance sm:text-[44px]" data-testid="store-course-title">
              {c.title}
            </h1>
            {(c.summary ?? c.general_objective) && <p className="text-[17px] leading-relaxed text-white/85">{c.summary ?? c.general_objective}</p>}
            <p className="flex flex-wrap gap-2 text-sm">
              {[hoursText(c.workload_minutes), `${c.modules.length} módulos`, v ? `${v} min de vídeo` : null, "Certificado"].filter(Boolean).map((f) => (
                <span key={f} className="rounded-full border border-white/30 bg-navy/40 px-3.5 py-1.5">
                  {f}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 pt-8 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:pb-14">
        <aside
          className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_28px_rgba(3,27,53,0.12)] lg:sticky lg:top-24 lg:order-2 lg:-mt-48"
          data-testid="store-price"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capaDoCurso(c.code)} alt="" className="hidden aspect-[16/9] w-full object-cover lg:block" />
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <p className="text-xs text-muted">
                {c.code} · versão {c.version_label}
              </p>
              <p className="font-display text-[34px] leading-tight font-extrabold text-navy">{brl(c.price)}</p>
              <p className="text-sm text-muted">Pix, cartão ou boleto pelo Mercado Pago</p>
            </div>
            <Link
              href={`/cursos/${c.code}/comprar`}
              className="flex min-h-12 items-center justify-center rounded-full bg-green px-5 text-[15px] font-semibold text-navy shadow-[0_6px_18px_rgba(128,187,8,0.35)] hover:bg-[#8cc912]"
              data-testid="buy-button"
            >
              Comprar o curso
            </Link>
            <ul className="flex flex-col gap-2 text-sm text-ink">
              {inclui.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check size={17} className="mt-0.5 shrink-0 text-green-dark" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-12 lg:order-1">
          <section aria-labelledby="aprender">
            <h2 id="aprender" className={h2}>
              O que você vai aprender
            </h2>
            <ol className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white" data-testid="store-modules">
              {c.modules.map((m, i) => {
                const mins = (m.video_minutes ?? 0) + (m.reading_minutes ?? 0) + (m.activity_minutes ?? 0);
                return (
                  <li key={m.position}>
                    <details open={i === 0} className="group px-5">
                      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="flex flex-col">
                          <span className="text-[11px] font-bold tracking-[0.06em] text-green-dark uppercase">
                            Módulo {mm(m.position)}
                            {mins ? ` · ${hoursText(mins)}` : ""}
                          </span>
                          <span className="font-semibold text-navy">{m.title}</span>
                        </span>
                        <span className="font-display shrink-0 text-2xl leading-none text-green-dark group-open:rotate-45 motion-safe:transition" aria-hidden>
                          +
                        </span>
                      </summary>
                      <div className="flex flex-col gap-2 pb-4 text-sm text-muted">
                        {m.objective && <p>{m.objective}</p>}
                        <p className="flex flex-wrap gap-x-4 gap-y-1">
                          {m.reading_minutes ? <span>Apostila · {m.reading_minutes} min</span> : null}
                          {m.has_video && m.video_minutes ? <span>Videoaula · {m.video_minutes} min</span> : null}
                          {m.activity_minutes ? <span>Atividades · {m.activity_minutes} min</span> : null}
                        </p>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="funciona">
            <h2 id="funciona" className={h2}>
              Como funciona cada módulo
            </h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {passos.map((s) => (
                <li key={s.t} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-50 text-green-dark">
                    <s.icon size={22} aria-hidden />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-bold text-navy">{s.t}</span>
                    <span className="text-sm text-muted">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {(c.audience || c.instructor_name) && (
            <section className="grid gap-6 sm:grid-cols-2">
              {c.audience && (
                <div>
                  <h2 className="font-display text-lg font-bold text-navy">Para quem é</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink/80">
                    {[c.audience, c.prerequisites]
                      .filter(Boolean)
                      .map((t) => t!.trim().replace(/[.;]?$/, "."))
                      .join(" ")}
                  </p>
                </div>
              )}
              {c.instructor_name && (
                <div>
                  <h2 className="font-display text-lg font-bold text-navy">Instrutor</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{c.instructor_name}</p>
                </div>
              )}
            </section>
          )}

          {c.important_notice && (
            <section className="flex gap-3 rounded-r-xl border-l-4 border-warn bg-late-50 p-4" aria-label="Importante">
              <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <p className="text-[15px] leading-relaxed text-ink">
                <strong>Importante. </strong>
                {c.important_notice}
              </p>
            </section>
          )}

          <section aria-labelledby="perguntas" className="max-w-3xl">
            <h2 id="perguntas" className={h2}>
              Perguntas frequentes
            </h2>
            <Perguntas itens={faq} primeiraAberta />
          </section>
        </main>
      </div>

      <div className="barra-compra fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(3,27,53,0.08)] lg:hidden">
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight font-extrabold text-navy">{brl(c.price)}</p>
          <p className="truncate text-xs text-muted">{[hoursText(c.workload_minutes), `${c.modules.length} módulos`].filter(Boolean).join(" · ")}</p>
        </div>
        <Link href={`/cursos/${c.code}/comprar`} className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-green px-6 font-semibold text-navy">
          Comprar
        </Link>
      </div>
    </PublicPage>
  );
}
