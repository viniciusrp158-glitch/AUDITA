import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ClipboardCheck, PlayCircle, ShieldCheck } from "lucide-react";
import { brl, hoursText, storeCourse, type StoreCourse } from "@/lib/vitrine";
import { PublicPage } from "../../loja";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const r = await storeCourse(codigo);
  return { title: r?.curso?.title ?? "Curso", robots: { index: true, follow: true } };
}

const mm = (p: number) => String(p).padStart(2, "0");
const sum = (c: StoreCourse, k: "video_minutes" | "reading_minutes" | "activity_minutes") => c.modules.reduce((s, m) => s + (m[k] ?? 0), 0);

export default async function CursoVendaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const r = await storeCourse(codigo);
  const c = r?.aberta ? r.curso : null;
  if (!c) notFound();
  const videos = c.modules.filter((m) => m.has_video).length;
  const [v, l, a] = [sum(c, "video_minutes"), sum(c, "reading_minutes"), sum(c, "activity_minutes")];
  const highlights = [
    videos ? `${videos} ${videos === 1 ? "videoaula" : "videoaulas"}` : null,
    `${c.modules.length} ${c.modules.length === 1 ? "apostila" : "apostilas"} em PDF`,
    "Avaliações com retorno comentado",
    "Certificado com código de verificação",
  ].filter(Boolean) as string[];
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

  return (
    <PublicPage>
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div>
            <p className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md bg-white/10 px-2.5 py-1">Curso livre</span>
              {c.modality && <span className="rounded-md bg-white/10 px-2.5 py-1">{c.modality}</span>}
              <span className="rounded-md bg-white/10 px-2.5 py-1">
                {[hoursText(c.workload_minutes), `${c.modules.length} módulos`].filter(Boolean).join(" · ")}
              </span>
            </p>
            <h1 className="mt-4 text-3xl leading-tight font-extrabold sm:text-[40px]" data-testid="store-course-title">
              {c.title}
            </h1>
            {(c.summary ?? c.general_objective) && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/85">{c.summary ?? c.general_objective}</p>}
            <ul className="mt-6 grid gap-2 text-sm text-white/90 sm:grid-cols-2">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-green" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          </div>
          <aside className="rounded-2xl bg-white p-6 text-ink shadow-[0_8px_30px_rgba(0,0,0,0.25)]" data-testid="store-price">
            <p className="text-sm text-muted">{c.code} · versão {c.version_label}</p>
            <p className="mt-1 text-[34px] font-extrabold text-navy">{brl(c.price)}</p>
            <p className="text-sm text-muted">Pix, cartão ou boleto · {c.access_days ? `acesso por ${c.access_days} dias` : "acesso sem prazo"}</p>
            <Link
              href={`/cursos/${c.code}/comprar`}
              className="mt-5 flex min-h-12 items-center justify-center rounded-[10px] bg-green px-5 text-[15px] font-extrabold text-navy"
              data-testid="buy-button"
            >
              Comprar agora
            </Link>
            <p className="mt-3 text-xs text-muted">Pagamento processado pelo Mercado Pago.</p>
          </aside>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6">
        <section>
          <h2 className="text-2xl font-extrabold text-navy">O que você vai aprender</h2>
          <ol className="mt-5 grid gap-3 md:grid-cols-2" data-testid="store-modules">
            {c.modules.map((m) => {
              const mins = (m.video_minutes ?? 0) + (m.reading_minutes ?? 0) + (m.activity_minutes ?? 0);
              return (
                <li key={m.position} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-[11px] font-bold tracking-[0.06em] text-green-dark uppercase">
                    Módulo {mm(m.position)}
                    {mins ? ` · ${hoursText(mins)}` : ""}
                  </p>
                  <p className="mt-1 font-semibold text-navy">{m.title}</p>
                  {m.objective && <p className="mt-1 text-sm text-muted">{m.objective}</p>}
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-extrabold text-navy">Como funciona cada módulo</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BookOpen, t: "Apostila", d: "Leitura em PDF, para estudar e consultar quando quiser." },
              { icon: PlayCircle, t: "Videoaula", d: "Uma aula por módulo, com casos práticos." },
              { icon: ClipboardCheck, t: "Avaliação", d: "Questões na plataforma, com cronômetro e retorno comentado." },
              {
                icon: ShieldCheck,
                t: "Certificado",
                d: c.final ? `Ao concluir os módulos e acertar pelo menos ${c.final.pass_score} de ${c.final.objectives} na avaliação final.` : "Ao concluir todos os módulos.",
              },
            ].map((s) => (
              <li key={s.t} className="rounded-xl bg-white p-5 ring-1 ring-line">
                <s.icon size={22} className="text-green-dark" aria-hidden />
                <p className="mt-2 font-bold text-navy">{s.t}</p>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {c.audience && (
            <div>
              <h3 className="font-bold text-navy">Para quem é</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">{[c.audience, c.prerequisites].filter(Boolean).map((t) => t!.trim().replace(/[.;]?$/, ".")).join(" ")}</p>
            </div>
          )}
          {c.instructor_name && (
            <div>
              <h3 className="font-bold text-navy">Instrutor</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">{c.instructor_name}</p>
            </div>
          )}
          {c.important_notice && (
            <div>
              <h3 className="font-bold text-navy">Importante</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">{c.important_notice}</p>
            </div>
          )}
        </section>

        <section className="max-w-3xl">
          <h2 className="text-2xl font-extrabold text-navy">Perguntas frequentes</h2>
          <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
            {faq.map((f, i) => (
              <details key={f.q} open={i === 0} className="group px-5 py-4">
                <summary className="cursor-pointer font-semibold text-navy">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
