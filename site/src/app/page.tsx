import {
  BadgeCheck,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  FileSearch,
  Flame,
  FolderCheck,
  GraduationCap,
  HardHat,
  Info,
  Layers,
  Leaf,
  MapPin,
  MonitorSmartphone,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Cabecalho } from "@/components/cabecalho";
import { Resolvemos } from "@/components/resolvemos";
import { Rodape } from "@/components/rodape";
import { Curva, Foto, Logo } from "@/components/wireframe";
import { AVISO_CURSO_LIVRE, cursosPublicados } from "@/content/cursos";
import { EMPRESA, MAILTO, whatsapp } from "@/content/empresa";

/** Home: seções 1 a 15 do briefing (seção 9), na ordem. Textos da seção 4 (AUDDOC002). */

const DESTAQUES = [
  { texto: "SST, Meio Ambiente e SGI integrados", Icone: Layers },
  { texto: "2 plataformas próprias", Icone: MonitorSmartphone },
  { texto: "Capacitação AUDITA: Cursos EAD", Icone: GraduationCap },
  { texto: "A melhor escolha para sua empresa", Icone: BadgeCheck },
];

const DIFERENCIAIS = [
  { titulo: "Gestão orientada à tranquilidade do cliente", texto: "Acompanhamento técnico e informações acessíveis, mais previsibilidade e menos desorganização das obrigações.", Icone: Smile },
  { titulo: "Soluções adaptadas à realidade das pequenas e médias empresas", texto: "Serviços proporcionais às atividades, riscos, estrutura e necessidades de cada organização.", Icone: Building2 },
  { titulo: "Integração entre atendimento técnico e tecnologia", texto: "Plataformas próprias (PRO e HUB) para estruturar processos e organizar registros.", Icone: MonitorSmartphone },
  { titulo: "Rastreabilidade e transparência", texto: "Documentação padronizada, históricos, indicadores e acompanhamento de pendências.", Icone: FileSearch },
  { titulo: "Flexibilidade de contratação", texto: "Serviços pontuais, consultoria recorrente e soluções digitais por assinatura.", Icone: SlidersHorizontal },
];

const VALORES = [
  "Ética e responsabilidade",
  "Segurança e valorização da vida",
  "Conformidade e excelência técnica",
  "Transparência e confiança",
  "Inovação com propósito",
  "Responsabilidade ambiental",
  "Melhoria contínua",
];

const PILARES = [
  {
    titulo: "Segurança e Saúde do Trabalho",
    img: "IMG-03",
    foto: "inspeção de campo com EPI",
    itens: ["Consultoria recorrente de SST para pequenas empresas", "Inspeções periódicas de SST", "Apoio à estruturação e manutenção do PGR/GRO", "Treinamentos in company por norma"],
    link: { rotulo: "Ver gestão recorrente de SST", href: "/solucoes/gestao-recorrente-de-sst/" },
  },
  {
    titulo: "Meio Ambiente",
    img: "IMG-04",
    foto: "coleta seletiva ou resíduos em ambiente industrial",
    itens: ["Controle documental ambiental e gestão de vencimentos", "Apoio a registros de resíduos e rotinas ambientais"],
    link: { rotulo: "Ver soluções de Meio Ambiente", href: "/solucoes/meio-ambiente/" },
  },
  {
    titulo: "Sistemas de Gestão (SGI)",
    img: "IMG-05",
    foto: "auditoria com checklist e documentos",
    itens: ["Auditoria interna de SGI (ISO 9001, 14001, 45001)", "Auditoria interna de SST e conformidade de NR", "Auditoria de fornecedores (segunda parte)", "Diagnóstico preparatório para certificação SGI"],
    nota: "Auditoria interna e diagnóstico não são certificação.",
    link: { rotulo: "Ver auditorias internas e SGI", href: "/solucoes/auditorias-internas-e-sgi/" },
  },
];

type Icone = React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

export default function Home() {
  const cursos = cursosPublicados();
  return (
    <>
      <Cabecalho />
      <main>
        {/* 3 Hero (1 Barra e 2 Header ficam no Cabecalho) */}
        <section className="hero" aria-labelledby="hero-titulo">
          <div className="hero__foto" aria-hidden="true">
            <span style={{ fontWeight: 700 }}>IMG-01 · imagem provisória</span>
            <span>vídeo de 10 a 15 s em loop, mudo: profissional de capacete conferindo um tablet (no celular, IMG-01m vertical)</span>
          </div>
          <div className="container hero__conteudo">
            <div>
              <p className="kicker">SSMA &amp; SGI</p>
              <h1 id="hero-titulo" className="t1" style={{ maxWidth: "14ch" }}>
                Gestão inteligente para ambientes mais <span className="marca-texto">seguros</span>.
              </h1>
              <p className="texto-grande medida" style={{ margin: "20px 0 0", maxWidth: "52ch" }}>
                Soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão para pequenas e médias empresas.
              </p>
              <div className="acoes">
                <a className="btn btn--principal btn--bloco" href={whatsapp()} target="_blank" rel="noopener">Fale com a AUDITA</a>
                <a className="btn btn--contorno-claro btn--bloco" href="#solucoes">Conheça nossas soluções</a>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CardVidro nome="Audita PRO" logo="pro-negativa" texto="Auditorias e documentos de SSMA e SGI, acompanhados em tempo real." login={EMPRESA.proLogin} />
              <CardVidro nome="Audita HUB" logo="hub-negativa" texto="A rotina de SSMA da sua empresa em um só lugar." login={EMPRESA.hubLogin} />
            </div>
          </div>
          <Curva cor="var(--navy)" />
        </section>

        {/* 4 Faixa de destaques */}
        <section className="secao secao--escura" style={{ padding: "40px 0 48px" }} aria-label="Destaques">
          <ul className="container grade grade--4" style={{ listStyle: "none", margin: "0 auto" }}>
            {DESTAQUES.map(({ texto, Icone }, i) => (
              <li key={texto} className="com-losango" data-revelar="" style={{ display: "flex", alignItems: "center", gap: 16, fontWeight: 600, transitionDelay: `${i * 120}ms` }}>
                <span className="losango" aria-hidden="true"><Icone /></span>
                {texto}
              </li>
            ))}
          </ul>
        </section>

        {/* 5 Quem somos */}
        <section id="quem-somos" className="secao" aria-labelledby="quem-somos-titulo">
          <div className="container grade grade--2 grade--meio">
            <div data-revelar="">
              <p className="kicker">A AUDITA</p>
              <h2 id="quem-somos-titulo" className="t2">Quem somos</h2>
              <p className="medida" style={{ margin: "20px 0 0" }}>
                A AUDITA integra conhecimento técnico, gestão preventiva e tecnologia para oferecer soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão, ajudando organizações a administrar suas obrigações, prevenir riscos e aprimorar processos com mais controle, eficiência e tranquilidade.
              </p>
              <p className="medida" style={{ margin: "16px 0 0" }}>
                <strong>Propósito:</strong> proporcionar tranquilidade às organizações, transformando a complexidade da gestão de Segurança, Saúde e Meio Ambiente em processos mais simples, preventivos, transparentes e confiáveis.
              </p>
              <div className="acoes">
                <Link className="btn btn--contorno btn--bloco" href="/a-audita/">Conheça a AUDITA</Link>
              </div>
            </div>
            <div className="foto--redonda" data-revelar="direita">
              <Foto codigo="IMG-02" descricao="profissional com EPI conversando com gestor em ambiente de trabalho real" style={{ height: 380 }} />
              <Curva />
            </div>
          </div>
        </section>

        {/* 6 Nossas soluções */}
        <section id="solucoes" className="secao secao--cinza" aria-labelledby="solucoes-titulo">
          <div className="container">
            <p className="kicker">Soluções</p>
            <h2 id="solucoes-titulo" className="t2">Nossas soluções</h2>
            <div className="grade grade--3" style={{ marginTop: 40 }}>
              {PILARES.map((p, i) => (
                <article key={p.titulo} className="card" data-revelar="" style={{ transitionDelay: `${i * 120}ms` }}>
                  <div style={{ overflow: "hidden" }}>
                    <Foto codigo={p.img} descricao={p.foto} className="zoom" style={{ height: 200 }} />
                  </div>
                  <div className="card__corpo">
                    <h3 className="t3">{p.titulo}</h3>
                    <ul className="lista">{p.itens.map((item) => <li key={item}>{item}</li>)}</ul>
                    {p.nota ? <p className="mutado" style={{ margin: 0, fontSize: 14 }}>{p.nota}</p> : null}
                    <a href={p.link.href} style={{ fontWeight: 600, color: "var(--green-text)" }}>{p.link.rotulo}</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 7 Diferenciais: Audita PRO e Audita HUB */}
        <section id="plataformas" className="grade grade--2" style={{ gap: 0 }} aria-label="Audita PRO e Audita HUB">
          <Produto
            nome="Audita PRO"
            classe="produto"
            logo="pro"
            texto="Planejamento, execução e relatórios de auditorias de SSMA e SGI em uma só plataforma. A sua empresa acompanha cada etapa em tempo real."
            itens={[
              { t: "Painéis com indicadores e gráficos por perfil", I: ClipboardCheck },
              { t: "Checklists por norma, inclusive auditorias integradas", I: FileSearch },
              { t: "Relatório diário gerado a partir dos registros de campo", I: FolderCheck },
              { t: "Documentos em PDF com revisões controladas", I: BookOpenCheck },
            ]}
            imagem={{ src: "/images/plataformas/pro-no-celular.webp", alt: "Dois celulares com indicadores de auditoria e a linha do tempo do Audita PRO" }}
            chamada="Quero conhecer"
            login={EMPRESA.proLogin}
            botao="btn btn--pro btn--bloco"
            lado="esquerda"
          />
          <Produto
            nome="Audita HUB"
            classe="produto produto--hub"
            logo="hub"
            texto="A rotina de SSMA da sua empresa em um só lugar: trabalhadores, EPIs, inspeções, ações, documentos, CIPA, emergências, capacitações e meio ambiente."
            itens={[
              { t: "Entrega de EPI com registro de ciência do trabalhador", I: HardHat },
              { t: "Inspeções com foto no celular e ações corretivas ligadas", I: ShieldCheck },
              { t: "Documentos e licenças com alerta de vencimento", I: FolderCheck },
              { t: "Calendário único de prazos e relatório consolidado", I: Flame },
            ]}
            imagem={{ src: "/images/plataformas/hub-computador-e-celular.webp", alt: "Painel de SSMA do Audita HUB no notebook e inspeção em campo no celular" }}
            chamada="Solicitar demonstração"
            login={EMPRESA.hubLogin}
            botao="btn btn--hub btn--bloco"
            lado="direita"
          />
        </section>

        {/* 8 O que resolvemos */}
        <Resolvemos />

        {/* 9 Por que a AUDITA */}
        <section id="por-que-a-audita" className="secao" aria-labelledby="por-que-titulo">
          <div className="container">
            <p className="kicker">Diferenciais</p>
            <h2 id="por-que-titulo" className="t2">Por que a AUDITA</h2>
            <ul className="grade grade--5" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {DIFERENCIAIS.map(({ titulo, texto, Icone }, i) => (
                <li key={titulo} className="com-losango" data-revelar="" style={{ transitionDelay: `${i * 100}ms` }}>
                  <span className="losango" aria-hidden="true" style={{ margin: "10px 10px 22px" }}><Icone /></span>
                  <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.35 }}>{titulo}</p>
                  <p className="mutado" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10 Como trabalhamos */}
        <section id="como-trabalhamos" className="secao secao--cinza" aria-labelledby="como-titulo">
          <div className="container">
            <p className="kicker">Método</p>
            <h2 id="como-titulo" className="t2">Como trabalhamos</h2>
            <ol className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {["Diagnóstico", "Plano de ação", "Implantação e treinamento", "Acompanhamento e melhoria contínua"].map((passo, i) => (
                <li key={passo} className="passo" data-revelar="" style={{ display: "flex", alignItems: "center", gap: 16, transitionDelay: `${i * 250}ms` }}>
                  <span className="passo__num">{i + 1}</span>
                  <span className="t3" style={{ fontSize: 19 }}>{passo}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 11 Cursos EAD */}
        <section id="cursos" className="secao" aria-labelledby="cursos-titulo">
          <div className="container grade grade--2">
            <div data-revelar="">
              <p className="kicker">Cursos EAD</p>
              <h2 id="cursos-titulo" className="t2">
                Capacitação que gera <span className="marca-texto">cultura de segurança</span>.
              </h2>
              <Foto codigo="IMG-16" descricao="pessoa estudando no notebook" className="foto--redonda" style={{ height: 240, marginTop: 32 }} />
            </div>
            <div data-revelar="">
              <div className="trilho">
                {cursos.map((c) => (
                  <a key={c.codigo} className="card" href={`${EMPRESA.treinamentos}/cursos/${c.codigo}`} style={{ textDecoration: "none" }}>
                    <Foto codigo={`Capa ${c.codigo}`} descricao="capa do curso (padrão AUDITA, a enviar)" style={{ height: 170 }} />
                    <div className="card__corpo">
                      <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.35 }}>{c.titulo}</p>
                      <p className="mutado" style={{ margin: 0, fontSize: 14 }}>{c.horas} h · {c.area}</p>
                    </div>
                  </a>
                ))}
                <div style={{ border: "2px dashed var(--line)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, boxSizing: "border-box", color: "var(--gray)", fontSize: 14 }}>
                  Novos cursos aparecem aqui assim que forem publicados na plataforma
                </div>
              </div>
              <div className="acoes">
                <a className="btn btn--principal btn--bloco" href={`${EMPRESA.treinamentos}/cursos`}>Comprar na plataforma</a>
                <Link className="btn btn--contorno btn--bloco" href="/cursos/">Ver todos os cursos</Link>
              </div>
              <p className="aviso" style={{ margin: "24px 0 0" }}>
                <Info aria-hidden="true" size={20} style={{ flex: "none", marginTop: 1 }} />
                <span>{AVISO_CURSO_LIVRE}</span>
              </p>
            </div>
          </div>
        </section>

        {/* 12 Missão, visão e valores */}
        <section id="missao-visao-valores" className="secao" style={{ background: "var(--gray-bg)" }} aria-labelledby="mvv-titulo">
          <Foto codigo="IMG-17" descricao="paisagem com indústria e vegetação, fundo suave" style={{ position: "absolute", inset: 0, background: "#e8eef2", alignItems: "flex-end", justifyContent: "flex-start", flexDirection: "row", padding: "20px 24px" }} />
          <div className="container" style={{ position: "relative" }}>
            <p className="kicker">Identidade</p>
            <h2 id="mvv-titulo" className="t2">Missão, visão e valores</h2>
            <div className="grade grade--3" style={{ marginTop: 40 }}>
              <Pilar rotulo="Missão" Icone={ShieldCheck}>
                <p style={{ margin: 0 }}>Oferecer soluções técnicas e tecnológicas em SSMA e SGI que simplifiquem a gestão, fortaleçam a prevenção de riscos e apoiem o atendimento aos requisitos legais e normativos, promovendo ambientes de trabalho mais seguros, responsáveis e eficientes.</p>
              </Pilar>
              <Pilar rotulo="Visão" Icone={Users}>
                <p style={{ margin: 0 }}>Ser reconhecida nacionalmente como referência em soluções integradas de Segurança, Saúde, Meio Ambiente e Sistemas de Gestão, conectando empresas, profissionais qualificados e tecnologias inovadoras.</p>
              </Pilar>
              <Pilar rotulo="Valores" Icone={Leaf}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", lineHeight: 1.8 }}>{VALORES.map((v) => <li key={v}>{v}</li>)}</ul>
              </Pilar>
            </div>
          </div>
        </section>

        {/* 13 Fale conosco */}
        <section id="contato" className="secao" aria-labelledby="contato-titulo">
          <div className="container grade grade--2 grade--meio">
            <div data-revelar="">
              <p className="kicker">Contato</p>
              <h2 id="contato-titulo" className="t2">Vamos organizar a segurança da sua empresa?</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28, maxWidth: 440 }}>
                <a className="btn btn--principal btn--grande" href={whatsapp()} target="_blank" rel="noopener">WhatsApp {EMPRESA.telefone}</a>
                <a className="btn btn--contorno btn--grande" href={MAILTO}>{EMPRESA.email}</a>
              </div>
              <p className="mutado" style={{ margin: "20px 0 0", fontSize: 14, display: "flex", gap: 8 }}>
                <MapPin aria-hidden="true" size={18} style={{ flex: "none", marginTop: 2, color: "var(--green-text)" }} />
                {EMPRESA.endereco}
              </p>
            </div>
            <Foto codigo="IMG-18" descricao="aperto de mãos entre profissional com capacete e gestor" className="foto--redonda" style={{ height: 340 }} />
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}

function CardVidro({ nome, logo, texto, login }: { nome: string; logo: "pro-negativa" | "hub-negativa"; texto: string; login: string }) {
  return (
    <div className="vidro">
      <Logo nome={logo} />
      <p style={{ fontSize: 13, color: "#d9e2e9" }}>Uma solução AUDITA</p>
      <p style={{ fontSize: 14, lineHeight: 1.5 }}>{texto}</p>
      <p className="links">
        <Link href={nome === "Audita PRO" ? "/audita-pro/" : "/audita-hub/"}>Conhecer</Link>
        <a href={login} target="_blank" rel="noopener" className="externo" aria-label={`Acessar o ${nome} (abre em nova aba, área exclusiva para clientes)`}>
          Acessar
        </a>
      </p>
    </div>
  );
}

function Produto(p: {
  nome: string;
  classe: string;
  logo: "pro" | "hub";
  texto: string;
  itens: { t: string; I: Icone }[];
  imagem: { src: string; alt: string };
  chamada: string;
  login: string;
  botao: string;
  lado: "esquerda" | "direita";
}) {
  return (
    <div className={p.classe}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h2 style={{ margin: 0 }}>
          <Logo nome={p.logo} />
        </h2>
        <p style={{ margin: "8px 0 20px", fontSize: 14, fontWeight: 600 }}>Uma solução AUDITA</p>
        <p className="texto-grande" style={{ margin: 0 }}>{p.texto}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10 }}>
          {p.itens.map(({ t, I }) => (
            <li key={t} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <I aria-hidden={true} size={22} className="produto__icone" />
              {t}
            </li>
          ))}
        </ul>
        <div data-revelar={p.lado} style={{ marginTop: 28 }}>
          <Link href={p.nome === "Audita PRO" ? "/audita-pro/" : "/audita-hub/"} style={{ display: "block", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- site estático, imagem já em WebP */}
            <img src={p.imagem.src} alt={p.imagem.alt} width={1600} height={1000} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
          </Link>
          <p className="mutado" style={{ margin: "6px 0 0", fontSize: 13 }}>Tela real com dados fictícios de demonstração.</p>
        </div>
        <div className="acoes" style={{ alignItems: "flex-start" }}>
          <a className={p.botao} href={whatsapp(p.chamada === "Quero conhecer" ? `Olá! Quero conhecer o ${p.nome}.` : `Olá! Quero uma demonstração do ${p.nome}.`)} target="_blank" rel="noopener">{p.chamada}</a>
          <span style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", maxWidth: 260 }}>
            <a className="btn btn--contorno externo" href={p.login} target="_blank" rel="noopener" aria-label={`Acessar o ${p.nome} (abre em nova aba, área exclusiva para clientes)`}>Acessar</a>
            <span className="mutado" style={{ fontSize: 13 }}>Área exclusiva para clientes</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Pilar({ rotulo, Icone, children }: { rotulo: string; Icone: Icone; children: React.ReactNode }) {
  return (
    <div data-revelar="" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontSize: 15, lineHeight: 1.6, background: "rgba(255,255,255,0.88)", borderRadius: 16, padding: "24px 20px" }}>
      <div style={{ position: "relative", width: 104, height: 104, display: "grid", placeItems: "center", margin: 20 }}>
        <div style={{ position: "absolute", inset: 0, transform: "rotate(45deg)", border: "3px solid var(--green)", borderRadius: 16, background: "var(--navy)" }} />
        <span style={{ position: "relative", color: "var(--green)", display: "grid", placeItems: "center" }}>
          <Icone aria-hidden={true} size={32} />
        </span>
      </div>
      <h3 style={{ margin: "12px 0 0", font: "700 20px/1.3 var(--font-display), Arial, sans-serif" }}>
        <span className="marca-texto">{rotulo}</span>
      </h3>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
