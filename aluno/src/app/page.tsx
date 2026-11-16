import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { whatsapp } from "@/lib/academy";
import { createClient } from "@/lib/supabase/server";
import { catalog, hoursText } from "@/lib/vitrine";
import { Destaques } from "./destaques";
import { PublicPage } from "./loja";
import { AcademyLogo } from "./shell";
import { AVISO_LIVRE, CursoCard, CursoDestaque, Passos, Perguntas } from "./vitrine-ui";

export const metadata = {
  title: { absolute: "Audita Academy · Cursos de SST online" },
  description:
    "Audita Academy, a plataforma de treinamentos da AUDITA | SSMA & SGI: cursos livres online com apostila, videoaula, avaliação e certificado verificável.",
};
export const dynamic = "force-dynamic";

const MSG_EMPRESA = "Olá! Quero levar os cursos da Audita Academy para a minha equipe.";
const kicker = "text-sm font-semibold tracking-[0.08em] uppercase";
const h2 = "font-display text-3xl font-extrabold sm:text-4xl";

/** Página inicial da Audita Academy (planejamento aprovado em 16/11/2026). Aluno com sessão vai direto para Meus cursos. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/meus-cursos");

  const c = await catalog();
  const cursos = c?.aberta ? c.cursos : [];
  const destaque = cursos[0];

  return (
    <PublicPage>
      <section className="relative overflow-hidden bg-navy text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/treinamentos/brand/topo.webp" alt="" className="absolute inset-0 size-full object-cover" />
        <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,27,53,0.95)_0%,rgba(3,27,53,0.78)_55%,rgba(3,27,53,0.45)_100%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6 lg:pt-20 lg:pb-32">
          <Destaques>
            {destaque ? (
              <div className="flex max-w-3xl flex-col gap-5">
                <span className="self-start rounded-full bg-green px-3 py-1 text-xs font-semibold tracking-[0.06em] text-navy uppercase">Curso em destaque</span>
                <h1 className="font-display text-[30px] leading-[1.12] font-extrabold text-balance sm:text-5xl">{destaque.title}</h1>
                {(destaque.summary ?? destaque.general_objective) && (
                  <p className="max-w-[56ch] text-[17px] text-white/85 sm:text-lg">{destaque.summary ?? destaque.general_objective}</p>
                )}
                <p className="flex flex-wrap gap-2 text-sm">
                  {[hoursText(destaque.workload_minutes), `${destaque.modules.length} módulos`, "100% online", "Certificado com QR code"]
                    .filter(Boolean)
                    .map((f) => (
                      <span key={f} className="rounded-full border border-white/30 bg-navy/40 px-3.5 py-1.5">
                        {f}
                      </span>
                    ))}
                </p>
                <p className="flex flex-wrap gap-3">
                  <Link
                    href={`/cursos/${destaque.code}`}
                    className="inline-flex min-h-12 items-center rounded-full bg-green px-6 font-semibold text-navy shadow-[0_6px_18px_rgba(128,187,8,0.35)] hover:bg-[#8cc912]"
                  >
                    Ver o curso
                  </Link>
                  <Link href="/cursos" className="inline-flex min-h-12 items-center rounded-full border-[1.5px] border-white px-6 font-semibold hover:bg-white/10">
                    Todos os cursos
                  </Link>
                </p>
              </div>
            ) : (
              <div className="flex max-w-3xl flex-col gap-5">
                <h1 className="font-display text-[30px] leading-[1.12] font-extrabold text-balance sm:text-5xl">Cursos de segurança e saúde no trabalho, no seu ritmo</h1>
                <p className="max-w-[56ch] text-lg text-white/85">As inscrições abrem em breve.</p>
              </div>
            )}
            <div className="flex max-w-3xl flex-col gap-5">
              <span className="self-start rounded-full bg-green px-3 py-1 text-xs font-semibold tracking-[0.06em] text-navy uppercase">Para empresas</span>
              <p className="font-display text-[30px] leading-[1.12] font-extrabold text-balance sm:text-5xl">Leve a Audita Academy para a sua equipe</p>
              <p className="max-w-[56ch] text-lg text-white/85">A AUDITA matricula a sua equipe de uma vez e acompanha o andamento de cada pessoa.</p>
              <p>
                <a
                  href={whatsapp(MSG_EMPRESA)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-green px-6 font-semibold text-navy hover:bg-[#8cc912]"
                >
                  <MessageCircle size={18} aria-hidden /> Falar no WhatsApp
                </a>
              </p>
            </div>
          </Destaques>
        </div>
        <svg className="absolute inset-x-0 -bottom-px block h-10 w-full sm:h-16" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden>
          <path fill="var(--color-surface)" d="M0 60V30C360 70 1080 -10 1440 30V60Z" />
        </svg>
      </section>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="cursos-titulo">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-2">
              <p className={`${kicker} text-green-dark`}>Cursos</p>
              <h2 id="cursos-titulo" className={`${h2} text-navy`}>
                Comece por aqui
              </h2>
              <p className="text-muted">Estude no seu ritmo, no computador ou no celular.</p>
            </div>
            {cursos.length > 2 && (
              <Link href="/cursos" className="font-semibold text-navy underline-offset-4 hover:underline">
                Ver todos os cursos
              </Link>
            )}
          </div>
          {cursos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">As inscrições abrem em breve.</p>
          ) : cursos.length <= 2 ? (
            <div className="flex flex-col gap-6">
              {cursos.map((k) => (
                <CursoDestaque key={k.code} c={k} />
              ))}
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cursos.slice(0, 6).map((k) => (
                <CursoCard key={k.code} c={k} />
              ))}
            </ul>
          )}
        </section>

        <section id="como" className="bg-navy text-white" aria-labelledby="como-titulo">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
            <div className="flex max-w-2xl flex-col gap-2">
              <p className={`${kicker} text-green`}>Como funciona</p>
              <h2 id="como-titulo" className={h2}>
                Cada módulo segue o mesmo caminho
              </h2>
            </div>
            <Passos />
          </div>
        </section>

        <section id="certificado" className="bg-white" aria-labelledby="cert-titulo">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <p className={`${kicker} text-green-dark`}>Certificado</p>
              <h2 id="cert-titulo" className={`${h2} text-navy`}>
                Qualquer pessoa pode conferir um certificado
              </h2>
              <p className="text-muted">Cada certificado tem um código único. Digite o código ou aponte a câmera do celular para o QR code impresso.</p>
              <form action="/treinamentos/certificado" method="get" className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-0 flex-[2_1_220px] flex-col gap-1.5 text-sm font-medium text-ink">
                  Código do certificado
                  <input
                    name="codigo"
                    autoComplete="off"
                    placeholder="XXXX-XXXX-XXXX"
                    className="min-h-12 rounded-[10px] border-[1.5px] border-line px-3.5 font-mono text-base uppercase outline-none focus:border-green-dark focus:ring-2 focus:ring-green/25"
                  />
                </label>
                <button type="submit" className="min-h-12 rounded-full bg-navy px-6 text-[15px] font-semibold text-white hover:bg-navy-700">
                  Verificar
                </button>
              </form>
            </div>
            <figure className="m-0 flex flex-col items-center gap-3 rounded-2xl border-[6px] border-double border-navy bg-white p-8 text-center">
              <AcademyLogo height={60} />
              <span className="text-xs font-semibold tracking-[0.1em] text-green-dark uppercase">Certificado de conclusão</span>
              <span className="font-display text-xl font-bold text-navy">Nome do aluno</span>
              <span className="max-w-[36ch] text-sm text-muted">concluiu o curso livre, com a carga horária, a data e o código de verificação.</span>
              <figcaption className="rounded-full bg-surface px-3 py-1 text-xs text-muted">Modelo ilustrativo</figcaption>
            </figure>
          </div>
        </section>

        <section id="empresas" aria-labelledby="emp-titulo">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/treinamentos/brand/empresas.webp"
              alt="Sala de treinamento vista do fundo, com participantes de costas"
              className="w-full rounded-2xl"
              width={1000}
              height={747}
            />
            <div className="flex flex-col items-start gap-4">
              <p className={`${kicker} text-green-dark`}>Para empresas</p>
              <h2 id="emp-titulo" className={`${h2} text-navy`}>
                Turmas e treinamentos in company
              </h2>
              <p className="text-muted">
                A AUDITA matricula a sua equipe de uma vez e acompanha o andamento de cada pessoa. Para temas específicos do seu local de trabalho, o
                treinamento é feito in company.
              </p>
              <a
                href={whatsapp(MSG_EMPRESA)}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-semibold text-white hover:bg-navy-700"
              >
                <MessageCircle size={18} aria-hidden /> Falar no WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section className="bg-white" aria-labelledby="faq-titulo">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 id="faq-titulo" className="font-display text-3xl font-extrabold text-navy">
              Perguntas frequentes
            </h2>
            <Perguntas
              itens={[
                { q: "Os cursos são 100% online?", a: "Sim. Apostila, videoaula e avaliação ficam na plataforma, no computador ou no celular." },
                { q: "Como é o pagamento?", a: "Pelo Mercado Pago, com Pix, cartão ou boleto. O acesso é liberado assim que o pagamento é confirmado." },
                { q: "Como confiro um certificado?", a: "Pelo código impresso no certificado, na opção Verificar certificado, ou pelo QR code." },
                { q: "Os cursos substituem os treinamentos obrigatórios das NRs?", a: AVISO_LIVRE },
              ]}
            />
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
