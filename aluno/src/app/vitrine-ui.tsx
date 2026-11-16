import Link from "next/link";
import { Clock, Layers } from "lucide-react";
import { areaDoCurso, capaDoCurso } from "@/lib/academy";
import { brl, hoursText, type StoreCourse } from "@/lib/vitrine";

/** Selos do curso: área (quando cadastrada), "Curso livre" e "Online". */
export function SelosCurso({ c, escuro = false }: { c: StoreCourse; escuro?: boolean }) {
  const area = areaDoCurso(c.code);
  const base = "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase";
  const neutro = escuro ? "border border-white/30 text-white" : "bg-surface text-ink";
  return (
    <p className="flex flex-wrap gap-2">
      {area && <span className={`${base} bg-green text-navy`}>{area}</span>}
      <span className={`${base} ${neutro}`}>Curso livre</span>
      <span className={`${base} ${neutro}`}>Online</span>
    </p>
  );
}

function Meta({ c }: { c: StoreCourse }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {hoursText(c.workload_minutes) && (
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} aria-hidden /> {hoursText(c.workload_minutes)}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <Layers size={15} aria-hidden /> {c.modules.length} {c.modules.length === 1 ? "módulo" : "módulos"}
      </span>
    </p>
  );
}

/** Cartão de curso: capa, selos, título, carga horária, módulos e preço. O cartão inteiro leva ao curso. */
export function CursoCard({ c }: { c: StoreCourse }) {
  const area = areaDoCurso(c.code);
  // data-busca e data-area: usados pelo filtro do catálogo (cursos/filtro.tsx)
  return (
    <li data-busca={[c.code, c.title, c.summary, area].filter(Boolean).join(" ")} data-area={area ?? undefined}>
      <Link
        href={`/cursos/${c.code}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_14px_32px_rgba(3,27,53,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span className="relative block aspect-[16/9] overflow-hidden bg-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capaDoCurso(c.code)} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none" />
        </span>
        <span className="flex flex-1 flex-col gap-3 p-5">
          <SelosCurso c={c} />
          <span className="font-display text-lg leading-snug font-bold text-navy">{c.title}</span>
          <Meta c={c} />
          <span className="mt-auto flex items-center justify-between gap-3 pt-2">
            <span className="font-display text-2xl font-extrabold text-navy">{brl(c.price)}</span>
            <span className="inline-flex min-h-10 items-center rounded-full bg-navy px-4 text-sm font-semibold text-white group-hover:bg-navy-700">Ver o curso</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Curso em destaque grande (vitrine com um ou dois cursos não parece vazia). */
export function CursoDestaque({ c }: { c: StoreCourse }) {
  return (
    <Link
      href={`/cursos/${c.code}`}
      className="group grid overflow-hidden rounded-2xl border border-line bg-white transition duration-200 hover:shadow-[0_14px_32px_rgba(3,27,53,0.14)] md:grid-cols-[1.1fr_1fr] motion-reduce:transition-none"
    >
      <span className="relative block aspect-[16/9] overflow-hidden bg-navy md:aspect-auto md:min-h-[320px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capaDoCurso(c.code)} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none" />
      </span>
      <span className="flex flex-col gap-4 p-6 sm:p-8">
        <SelosCurso c={c} />
        <span className="font-display text-2xl leading-tight font-extrabold text-navy sm:text-[28px]">{c.title}</span>
        {(c.summary ?? c.general_objective) && <span className="text-[15px] leading-relaxed text-ink/80">{c.summary ?? c.general_objective}</span>}
        <Meta c={c} />
        <span className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="font-display text-3xl font-extrabold text-navy">{brl(c.price)}</span>
          <span className="inline-flex min-h-12 items-center rounded-full bg-green px-6 text-[15px] font-semibold text-navy shadow-[0_6px_18px_rgba(128,187,8,0.35)]">
            Ver o curso
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Passos de cada módulo, iguais em todos os cursos (regra da plataforma). */
export const PASSOS = [
  { t: "Apostila", d: "Leitura em PDF, na tela ou baixada, para estudar e consultar quando quiser." },
  { t: "Videoaula", d: "Uma aula por módulo, com casos práticos." },
  { t: "Avaliação", d: "Questões na plataforma, com cronômetro e retorno comentado." },
  { t: "Certificado", d: "Emitido ao concluir os módulos, com código e QR code de verificação." },
];

/** Os quatro passos com o losango numerado do site institucional. */
export function Passos({ escuro = true }: { escuro?: boolean }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PASSOS.map((p, i) => (
        <li key={p.t} className={`flex flex-col gap-3 rounded-2xl p-5 ${escuro ? "border border-white/25 bg-white/5" : "border border-line bg-white"}`}>
          <span className="grid size-10 rotate-45 place-items-center rounded-xl bg-green" aria-hidden>
            <span className="font-display -rotate-45 font-extrabold text-navy">{i + 1}</span>
          </span>
          <span className={`font-display text-lg font-bold ${escuro ? "text-white" : "text-navy"}`}>{p.t}</span>
          <span className={`text-[15px] ${escuro ? "text-white/80" : "text-muted"}`}>{p.d}</span>
        </li>
      ))}
    </ol>
  );
}

/** Aviso de curso livre (mesmo sentido do texto "Importante" da ficha técnica do L01). */
export const AVISO_LIVRE =
  "Os cursos da Audita Academy são cursos livres. Eles não substituem capacitações obrigatórias específicas de NR, a integração sobre os riscos do local de trabalho, habilitação profissional ou autorização para atividades.";

/** Perguntas que abrem e fecham (sem script). */
export function Perguntas({ itens, primeiraAberta = false }: { itens: { q: string; a: string }[]; primeiraAberta?: boolean }) {
  return (
    <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
      {itens.map((f, i) => (
        <details key={f.q} open={primeiraAberta && i === 0} className="group px-5">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-navy [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="font-display shrink-0 text-2xl leading-none text-green-dark group-open:rotate-45 motion-safe:transition" aria-hidden>
              +
            </span>
          </summary>
          <p className="pb-4 text-[15px] leading-relaxed text-ink/80">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
