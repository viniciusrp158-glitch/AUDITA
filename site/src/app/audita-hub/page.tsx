import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Logo } from "@/components/wireframe";
import { LinkEmail } from "@/components/email";
import { EMPRESA } from "@/content/empresa";

/**
 * Página do Audita HUB (S8, 10/11/2026): conteúdo e visual do protótipo "audita-hub-pagina-site" enviado pela sessão do
 * HUB. Os textos são os do protótipo, revisados pela sessão do sistema; mudar texto só com o OK do Diretor.
 * Imagens: telas reais com dados fictícios, em /images/plataformas.
 */
const TITULO = "Audita HUB · Gestão de SST e Meio Ambiente em um só lugar | AUDITA";
const DESCRICAO =
  "Audita HUB: indicadores de SSMA, riscos do PGR por GHE e a gestão completa de Segurança do Trabalho e Meio Ambiente em uma plataforma, no computador e no celular.";

export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: DESCRICAO,
  alternates: { canonical: "/audita-hub/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "AUDITA | SSMA & SGI",
    url: "/audita-hub/",
    title: "Audita HUB · A rotina de SSMA em dia, em um só lugar",
    description: "Indicadores, riscos do PGR e a gestão completa de SST e Meio Ambiente, no computador e no celular.",
    images: [{ url: "/images/plataformas/hub-og.jpg", width: 1200, height: 630, alt: "Audita HUB" }],
  },
};

const WHATS_DEMO = "https://wa.me/5515996891049?text=Ol%C3%A1!%20Quero%20uma%20demonstra%C3%A7%C3%A3o%20do%20Audita%20HUB.";
const IMG = "/images/plataformas";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Audita HUB",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://audita.seg.br/audita-hub/",
  image: "https://audita.seg.br/images/plataformas/hub-og.jpg",
  description:
    "Plataforma de gestão de Segurança do Trabalho e Meio Ambiente: indicadores, riscos do PGR por GHE, EPIs, inspeções, ações, ocorrências, documentos, CIPA, brigada, capacitações, ordens de serviço, licenças e resíduos.",
  publisher: { "@type": "Organization", name: "AUDITA", url: "https://audita.seg.br" },
  inLanguage: "pt-BR",
};

/* Ícones do protótipo (traço) */
const ic = { className: "hubp-ic", viewBox: "0 0 24 24", "aria-hidden": true } as const;
const Icones = {
  modulos: <svg {...ic}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  aparelhos: <svg {...ic}><rect x="2" y="4" width="14" height="11" rx="2" /><rect x="17" y="8" width="5" height="12" rx="1" /></svg>,
  relogio: <svg {...ic}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  escudo: <svg {...ic}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  escudoCheck: <svg {...ic}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>,
  folha: <svg {...ic}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" /><path d="M2 21c0-3 1.9-5.4 5.1-6" /></svg>,
  calendario: <svg {...ic}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  sino: <svg {...ic}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /></svg>,
  arquivo: <svg {...ic}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>,
  trilha: <svg {...ic}><path d="M12 8v4l3 3" /><path d="M3.05 11a9 9 0 1 1 .5 4M3 4v5h5" /></svg>,
  pessoa: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" /></svg>,
  lua: <svg {...ic}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /></svg>,
};

function Tela({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`hubp-shot ${className ?? ""}`}>
      <div className="hubp-shot__bar" aria-hidden="true"><i /><i /><i /></div>
      <Image src={src} alt={alt} width={1920} height={1200} sizes="(max-width: 1024px) 100vw, 640px" loading="lazy" />
    </div>
  );
}

function Celular({ src, alt, prioridade }: { src: string; alt: string; prioridade?: boolean }) {
  return (
    <div className="hubp-phone">
      <Image src={src} alt={alt} width={780} height={1688} sizes="(max-width: 640px) 72vw, 290px" priority={prioridade} loading={prioridade ? undefined : "lazy"} />
    </div>
  );
}

export default function AuditaHub() {
  return (
    <>
      <Cabecalho ativo="Plataformas" />
      <main className="hubp">
        {/* 1. Topo */}
        <section className="hubp-hero" aria-labelledby="hubp-h1">
          <div className="container hubp-hero__inner">
            <nav aria-label="Você está em" className="migalhas hubp-migalhas">
              <Link href="/">Início</Link>
              <span aria-hidden="true">›</span>
              <Link href="/solucoes/">Plataformas</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page">Audita HUB</span>
            </nav>
            <p className="hubp-eyebrow">Plataforma de gestão de SSMA</p>
            <Logo nome="hub-negativa" alt="Audita HUB" className="hubp-logo" />
            <h1 id="hubp-h1" className="hubp-h1">
              Segurança do Trabalho e Meio Ambiente <em>em dia, em um só lugar.</em>
            </h1>
            <p className="hubp-lead hubp-hero__lead">
              Indicadores que mostram onde agir, riscos do PGR organizados por GHE e toda a rotina de SST e Meio Ambiente conectada, no computador e no celular.
            </p>
            <div className="hubp-ctas">
              <a className="hubp-btn hubp-btn--verde" href={WHATS_DEMO} target="_blank" rel="noopener">Agendar demonstração</a>
              <a className="hubp-btn hubp-btn--vazado" href="#indicadores">Conhecer o HUB</a>
            </div>
            <p className="hubp-note">
              Já é cliente? <a href={EMPRESA.hubLogin} target="_blank" rel="noopener">Acessar o Audita HUB</a>
            </p>
            <div className="hubp-hero__media">
              <Image className="hubp-hero__desk" src={`${IMG}/hub-computador-e-celular.webp`} alt="Painel do Audita HUB no computador e no celular" width={2000} height={1240} sizes="(max-width: 1200px) 100vw, 1120px" priority />
              <div className="hubp-hero__mob">
                <Celular src={`${IMG}/hub-celular-painel.webp`} alt="Painel do Audita HUB no celular" prioridade />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Destaques (fatos do produto) */}
        <section className="hubp-facts" aria-label="Destaques do Audita HUB">
          <div className="container hubp-facts__row">
            <div className="hubp-fact">{Icones.modulos}<div><b>14 módulos</b><span>de SST e Meio Ambiente integrados</span></div></div>
            <div className="hubp-fact">{Icones.aparelhos}<div><b>Computador e celular</b><span>sem instalar nada</span></div></div>
            <div className="hubp-fact">{Icones.relogio}<div><b>Avisos de prazo</b><span>antes de vencer, no sistema e por e-mail</span></div></div>
            <div className="hubp-fact">{Icones.escudo}<div><b>Dados protegidos</b><span>cada empresa vê só os seus</span></div></div>
          </div>
        </section>

        {/* 3. Indicadores */}
        <section className="hubp-sec hubp-feature" id="indicadores" aria-labelledby="hubp-ind">
          <div className="container hubp-feature__grid">
            <div className="hubp-text">
              <p className="hubp-eyebrow">Indicadores</p>
              <h2 id="hubp-ind" className="hubp-h2">Abra o HUB e saiba exatamente onde agir</h2>
              <p className="hubp-lead">O Dashboard reúne os números de todos os módulos em uma tela, e cada indicador explica em uma frase o que está contando.</p>
              <ul className="hubp-checks">
                <li>Índice de gestão SSMA de 0 a 100, com a composição aberta</li>
                <li>Ações vencidas, desvios sem ação, documentos a vencer e alertas de EPI</li>
                <li>Inspeções e desvios por semana, ações por status e suas tarefas</li>
                <li>Filtro por unidade e período, metas da empresa e relatório consolidado</li>
              </ul>
            </div>
            <div className="hubp-stack">
              <Tela className="hubp-stack__back" src={`${IMG}/hub-painel.webp`} alt="Dashboard com índice de gestão SSMA, alertas e gráficos" />
              <Tela className="hubp-stack__front" src={`${IMG}/hub-relatorio.webp`} alt="Relatório consolidado da empresa" />
            </div>
          </div>
        </section>

        {/* 4. PGR */}
        <section className="hubp-sec hubp-feature hubp-feature--rev hubp-cinza" aria-labelledby="hubp-pgr">
          <div className="container hubp-feature__grid">
            <div className="hubp-text">
              <p className="hubp-eyebrow">PGR</p>
              <h2 id="hubp-pgr" className="hubp-h2">Os riscos do PGR organizados e ligados à rotina</h2>
              <p className="hubp-lead">Monte o inventário de riscos por Grupo Homogêneo de Exposição, com a matriz de risco da empresa, e deixe que o HUB leve isso para o dia a dia.</p>
              <ul className="hubp-checks">
                <li>GHE com setores, cargos e trabalhadores vinculados</li>
                <li>Probabilidade × severidade com o nível de risco calculado</li>
                <li>Medidas existentes e propostas para cada risco</li>
                <li>EPIs e capacitações exigidos por GHE, cobrados nas entregas e na matriz de treinamentos</li>
              </ul>
            </div>
            <div className="hubp-stack">
              <Tela className="hubp-stack__back" src={`${IMG}/hub-pgr-matriz.webp`} alt="Matriz de risco do PGR" />
              <Tela className="hubp-stack__front" src={`${IMG}/hub-pgr.webp`} alt="Lista de GHE com riscos e maior nível" />
            </div>
          </div>
        </section>

        {/* 5. Gestão completa */}
        <section className="hubp-sec hubp-escuro hubp-suite" aria-labelledby="hubp-suite">
          <div className="container">
            <div className="hubp-head">
              <p className="hubp-eyebrow">Gestão completa</p>
              <h2 id="hubp-suite" className="hubp-h2">Toda a rotina de SST e Meio Ambiente, conectada</h2>
              <p className="hubp-lead">Contrate os módulos de que a empresa precisa. Um conversa com o outro: o desvio vira ação, o prazo vai para o calendário, o GHE define o EPI.</p>
            </div>
            <div className="hubp-cols">
              <div className="hubp-col">
                <h3>{Icones.escudoCheck}Segurança e Saúde do Trabalho</h3>
                <div className="hubp-mods">
                  {[
                    ["EPIs e uniformes", "Estoque, entregas, assinatura e ficha em PDF"],
                    ["Inspeções", "Checklists próprios, no celular, com fotos"],
                    ["Ações e Kanban", "Responsável, prazo, evidência e eficácia"],
                    ["Ocorrências", "5 porquês, Ishikawa, 5W2H e CAT"],
                    ["Documentos e laudos", "Revisões e alerta de vencimento"],
                    ["Ordens de serviço", "Emissão e ciência do trabalhador"],
                    ["CIPA", "Eleição com urna, reuniões e atas"],
                    ["Brigada e emergências", "Planos, contatos e simulados"],
                    ["Capacitações", "Matriz por cargo e vencimentos"],
                    ["Trabalhadores", "Cadastro, lotação e histórico"],
                  ].map(([t, d]) => (
                    <div key={t} className="hubp-mod"><b>{t}</b><span>{d}</span></div>
                  ))}
                </div>
              </div>
              <div className="hubp-col hubp-col--amb">
                <h3>{Icones.folha}Meio Ambiente</h3>
                <div className="hubp-mods">
                  {[
                    ["Licenças e condicionantes", "Validade, renovação, prazo e responsável"],
                    ["Resíduos", "Saídas, inventário e notas fiscais"],
                    ["LAIA", "Aspectos e impactos ambientais"],
                    ["Indicadores ambientais", "Geração e custos por período"],
                  ].map(([t, d]) => (
                    <div key={t} className="hubp-mod"><b>{t}</b><span>{d}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <ul className="hubp-all" aria-label="Em toda a plataforma">
              <li>{Icones.calendario}Calendário de prazos</li>
              <li>{Icones.sino}Avisos e notificações</li>
              <li>{Icones.arquivo}PDF e CSV</li>
              <li>{Icones.trilha}Trilha de auditoria</li>
              <li>{Icones.pessoa}Perfis e acesso por unidade</li>
              <li>{Icones.lua}Tema claro e escuro</li>
            </ul>
          </div>
        </section>

        {/* 6. No campo */}
        <section className="hubp-sec hubp-mobile" aria-labelledby="hubp-mob">
          <div className="container">
            <div className="hubp-head">
              <p className="hubp-eyebrow">No campo</p>
              <h2 id="hubp-mob" className="hubp-h2">O HUB vai aonde a segurança acontece</h2>
              <p className="hubp-lead">Inspeção na área, licença conferida na hora e o trabalhador assinando a entrega de EPI pelo próprio celular.</p>
            </div>
            <div className="hubp-phones">
              {[
                ["hub-celular-painel.webp", "Painel no celular", "Painel", "O que vence e o que está atrasado"],
                ["hub-celular-inspecao.webp", "Inspeção em campo no celular", "Inspeção em campo", "Item por item, com foto"],
                ["hub-celular-ambiente.webp", "Licenças ambientais no celular", "Meio Ambiente", "Licenças e condicionantes"],
                ["hub-celular-minhas-entregas.webp", "Entregas de EPI no acesso do trabalhador", "Acesso do trabalhador", "Entregas de EPI e assinatura"],
              ].map(([f, alt, t, d]) => (
                <figure key={f}>
                  <Celular src={`${IMG}/${f}`} alt={alt} />
                  <figcaption>{t}<span>{d}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Chamada final */}
        <section className="hubp-sec hubp-escuro hubp-final" aria-labelledby="hubp-final">
          <div className="container">
            <p className="hubp-eyebrow">Comece agora</p>
            <h2 id="hubp-final" className="hubp-h2">Veja o Audita HUB com a realidade da sua empresa</h2>
            <p className="hubp-lead">Assinatura com os módulos de que você precisa, usada pela sua equipe ou junto com a consultoria AUDITA.</p>
            <ol className="hubp-steps" aria-label="Como começar">
              <li><b>1</b>Demonstração</li>
              <li><b>2</b>Configuração dos módulos e acessos</li>
              <li><b>3</b>Equipe usando no dia a dia</li>
            </ol>
            <div className="hubp-ctas">
              <a className="hubp-btn hubp-btn--verde" href={WHATS_DEMO} target="_blank" rel="noopener">Agendar pelo WhatsApp</a>
              <LinkEmail className="hubp-btn hubp-btn--vazado" assunto="Demonstração do Audita HUB">Enviar e-mail</LinkEmail>
            </div>
            <p className="hubp-pro">
              O Audita PRO mostra onde a empresa está em relação às normas; o Audita HUB mantém a rotina em dia entre uma auditoria e outra. <Link href="/audita-pro/">Conheça o Audita PRO</Link>
            </p>
            <p className="hubp-disc">
              Telas reais com dados fictícios de demonstração. O Audita HUB é uma licença de software: apoia a organização da rotina, mas não assume a responsabilidade técnica da empresa nem garante conformidade.
            </p>
          </div>
        </section>
      </main>
      <Rodape />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
    </>
  );
}
