import { ClipboardCheck, GraduationCap, Info, Leaf, MapPin, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { Carrossel } from "@/components/carrossel";
import { Rodape } from "@/components/rodape";
import { Curva, Foto, LogoLugar, Tag } from "@/components/wireframe";
import { AVISO_CURSO_LIVRE, cursosPublicados } from "@/content/cursos";
import { EMPRESA, MAILTO, whatsapp } from "@/content/empresa";
import { FAMILIAS } from "@/content/servicos";

/** Home: seções 1 a 15 do briefing (seção 9), na ordem. Textos da seção 4 (AUDDOC002). */

const NECESSIDADES = [
  { texto: "Acompanhamento técnico periódico de SST e Meio Ambiente", img: "IMG-08", foto: "visita técnica" },
  { texto: "Organização e controle documental", img: "IMG-09", foto: "pastas e documentos organizados" },
  { texto: "Treinamentos e capacitações", img: "IMG-10", foto: "treinamento em sala" },
  { texto: "Gestão preventiva de riscos ocupacionais", img: "IMG-11", foto: "mapa de riscos" },
  { texto: "Rotinas de CIPA e brigada de emergência", img: "IMG-12", foto: "reunião de CIPA ou brigada" },
  { texto: "Auditorias internas, inspeções e diagnósticos", img: "IMG-13", foto: "auditoria interna" },
  { texto: "Controle de prazos, obrigações e ações corretivas", img: "IMG-14", foto: "quadro de prazos e plano de ação" },
  { texto: "Ferramentas digitais para acompanhar tudo isso", img: "IMG-15", foto: "tablet com sistema" },
];

const DIFERENCIAIS = [
  { titulo: "Gestão orientada à tranquilidade do cliente", texto: "Acompanhamento técnico e informações acessíveis, mais previsibilidade e menos desorganização das obrigações." },
  { titulo: "Soluções adaptadas à realidade das pequenas e médias empresas", texto: "Serviços proporcionais às atividades, riscos, estrutura e necessidades de cada organização." },
  { titulo: "Integração entre atendimento técnico e tecnologia", texto: "Plataformas próprias (PRO e HUB) para estruturar processos e organizar registros." },
  { titulo: "Rastreabilidade e transparência", texto: "Documentação padronizada, históricos, indicadores e acompanhamento de pendências." },
  { titulo: "Flexibilidade de contratação", texto: "Serviços pontuais, consultoria recorrente e soluções digitais por assinatura." },
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

export default function Home() {
  const cursos = cursosPublicados();
  return (
    <>
      <Cabecalho />
      <main>
        {/* 2 Header (no Cabecalho) + 3 Hero */}
        <section className="hero" aria-labelledby="hero-titulo">
          <Tag>1 · Barra · 2 · Header · 3 · Hero</Tag>
          <div className="hero__foto">IMG-01 · vídeo de 10 a 15 s em loop, mudo: profissional de capacete conferindo um tablet (no celular, IMG-01m vertical)</div>
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
              <CardVidro nome="Audita PRO" texto="Planejamento e execução de auditorias, evidências, constatações e relatórios." login={EMPRESA.proLogin} />
              <CardVidro nome="Audita HUB" texto="Gestão operacional de SST e Meio Ambiente, por assinatura." login={EMPRESA.hubLogin} />
            </div>
          </div>
          <Curva cor="var(--navy)" />
        </section>

        {/* 4 Faixa de destaques */}
        <section className="secao secao--escura" style={{ padding: "40px 0" }} aria-label="Destaques">
          <Tag>4 · Destaques</Tag>
          <ul className="container grade grade--4" style={{ listStyle: "none", margin: "0 auto" }}>
            {["SST, Meio Ambiente e SGI integrados", "2 plataformas próprias", "Cursos EAD com certificado", "Atendimento no estado de São Paulo"].map((t) => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 16, fontWeight: 600 }}>
                <span className="losango" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* 5 Quem somos */}
        <section id="quem-somos" className="secao" aria-labelledby="quem-somos-titulo">
          <Tag>5 · Quem somos</Tag>
          <div className="container grade grade--2 grade--meio">
            <div>
              <p className="kicker">A AUDITA</p>
              <h2 id="quem-somos-titulo" className="t2">Quem somos</h2>
              <p className="medida" style={{ margin: "20px 0 0" }}>
                A AUDITA integra conhecimento técnico, gestão preventiva e tecnologia para oferecer soluções em Segurança, Saúde, Meio Ambiente e Sistemas de Gestão, ajudando organizações a administrar suas obrigações, prevenir riscos e aprimorar processos com mais controle, eficiência e tranquilidade.
              </p>
              <p className="medida" style={{ margin: "16px 0 0" }}>
                <strong>Propósito:</strong> proporcionar tranquilidade às organizações, transformando a complexidade da gestão de Segurança, Saúde e Meio Ambiente em processos mais simples, preventivos, transparentes e confiáveis.
              </p>
              <div className="acoes">
                <a className="btn btn--contorno btn--bloco" href="#missao-visao-valores">Conheça a AUDITA</a>
              </div>
            </div>
            <div className="foto--redonda">
              <Foto codigo="IMG-02" descricao="profissional com EPI conversando com gestor em ambiente de trabalho real" style={{ height: 360 }} />
              <Curva traco="#8c8c8c" />
            </div>
          </div>
        </section>

        {/* 6 Nossas soluções */}
        <section id="solucoes" className="secao secao--cinza" aria-labelledby="solucoes-titulo">
          <Tag>6 · Soluções</Tag>
          <div className="container">
            <p className="kicker">Soluções</p>
            <h2 id="solucoes-titulo" className="t2">Nossas soluções</h2>
            <div className="grade grade--3" style={{ marginTop: 40 }}>
              {PILARES.map((p) => (
                <article key={p.titulo} className="card">
                  <Foto codigo={p.img} descricao={p.foto} style={{ height: 200 }} />
                  <div className="card__corpo">
                    <h3 className="t3">{p.titulo}</h3>
                    <ul className="lista">{p.itens.map((i) => <li key={i}>{i}</li>)}</ul>
                    {p.nota ? <p className="mutado" style={{ margin: 0, fontSize: 14 }}>{p.nota}</p> : null}
                    <a href={p.link.href} style={{ fontWeight: 600 }}>{p.link.rotulo}</a>
                  </div>
                </article>
              ))}
            </div>
            <p style={{ margin: "32px 0 0", fontSize: 15 }}>
              Todas as famílias:{" "}
              {FAMILIAS.map((f, i) => (
                <span key={f.slug}>
                  {i > 0 ? ", " : ""}
                  <a href={`/solucoes/${f.slug}/`}>{f.nome}</a>
                </span>
              ))}
              .
            </p>
          </div>
        </section>

        {/* 7 Audita PRO e Audita HUB */}
        <section id="plataformas" className="grade grade--2" style={{ gap: 0, position: "relative" }} aria-label="Audita PRO e Audita HUB">
          <Tag>7 · Audita PRO e Audita HUB</Tag>
          <Produto
            nome="Audita PRO"
            fundo="var(--pro-bg)"
            contexto="Contexto azul PRO"
            texto="Plataforma digital da AUDITA para organizar e apoiar a execução de auditorias e a gestão dos registros associados."
            itens={["Plano de auditoria e checklist", "Evidências e não conformidades", "Relatório diário (RDA) e relatório final", "Documentos e treinamentos"]}
            img="IMG-06"
            foto="mockup do Audita PRO em notebook (print real a enviar)"
            login={EMPRESA.proLogin}
          />
          <Produto
            nome="Audita HUB"
            fundo="var(--hub-bg)"
            contexto="Contexto verde HUB"
            texto="Solução da AUDITA para centralizar e acompanhar atividades de Segurança, Saúde e Meio Ambiente, por assinatura."
            itens={["Colaboradores e EPIs", "Documentos e ordens de serviço", "CIPA e brigada de emergência", "Riscos ocupacionais, treinamentos e planos de emergência"]}
            img="IMG-07"
            foto="mockup do Audita HUB em tablet ou celular (print real a enviar)"
            login={EMPRESA.hubLogin}
          />
        </section>

        {/* 8 O que resolvemos */}
        <section className="secao secao--escura" style={{ background: "var(--foto-escura)", overflow: "hidden" }} aria-labelledby="resolvemos-titulo">
          <Tag>8 · O que resolvemos</Tag>
          <div className="container">
            <p className="kicker">O que resolvemos</p>
            <h2 id="resolvemos-titulo" className="t2" style={{ maxWidth: "18ch" }}>
              A AUDITA atende empresas de <span className="marca-texto">todos os segmentos</span>.
            </h2>
            <p className="mutado" style={{ margin: "12px 0 32px", fontSize: 14 }}>Na Etapa 3 o fundo desta seção troca de foto conforme o card ativo.</p>
            <Carrossel rotulo="O que resolvemos" escuro>
              {NECESSIDADES.map((n) => (
                <div key={n.texto} style={{ background: "var(--white)", color: "var(--ink)", borderRadius: 16, padding: 20, height: "100%", boxSizing: "border-box" }}>
                  <Foto codigo={n.img} descricao={n.foto} style={{ height: 160, borderRadius: 8 }} />
                  <p className="t3" style={{ marginTop: 16, fontSize: 20 }}>{n.texto}</p>
                </div>
              ))}
            </Carrossel>
          </div>
        </section>

        {/* 9 Por que a AUDITA */}
        <section id="por-que-a-audita" className="secao" aria-labelledby="por-que-titulo">
          <Tag>9 · Por que a AUDITA</Tag>
          <div className="container">
            <p className="kicker">Diferenciais</p>
            <h2 id="por-que-titulo" className="t2">Por que a AUDITA</h2>
            <ul className="grade grade--5" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {DIFERENCIAIS.map((d) => (
                <li key={d.titulo}>
                  <span className="losango" aria-hidden="true" style={{ margin: "8px 8px 20px" }} />
                  <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.35 }}>{d.titulo}</p>
                  <p className="mutado" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>{d.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10 Como trabalhamos */}
        <section id="como-trabalhamos" className="secao secao--cinza" aria-labelledby="como-titulo">
          <Tag>10 · Como trabalhamos</Tag>
          <div className="container">
            <p className="kicker">Método</p>
            <h2 id="como-titulo" className="t2">Como trabalhamos</h2>
            <ol className="grade grade--4" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
              {["Diagnóstico", "Plano de ação", "Implantação e treinamento", "Acompanhamento e melhoria contínua"].map((passo, i) => (
                <li key={passo} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ display: "flex", flex: "none", width: 48, height: 48, borderRadius: "50%", background: "var(--navy)", color: "var(--white)", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{i + 1}</span>
                  <span className="t3" style={{ fontSize: 19 }}>{passo}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 11 Cursos EAD */}
        <section id="cursos" className="secao" aria-labelledby="cursos-titulo">
          <Tag>11 · Cursos EAD</Tag>
          <div className="container grade grade--2">
            <div>
              <p className="kicker">Cursos EAD</p>
              <h2 id="cursos-titulo" className="t2">
                Capacitação que gera <span className="marca-texto">cultura de segurança</span>.
              </h2>
              <Foto codigo="IMG-16" descricao="pessoa estudando no notebook" className="foto--redonda" style={{ height: 240, marginTop: 32 }} />
            </div>
            <div>
              <div className="trilho">
                {cursos.map((c) => (
                  <a key={c.codigo} className="card" href={`${EMPRESA.treinamentos}/cursos/${c.codigo}`} style={{ textDecoration: "none" }}>
                    <Foto codigo="Capa" descricao={`curso ${c.codigo}`} style={{ height: 170 }} />
                    <div className="card__corpo">
                      <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.35 }}>{c.titulo}</p>
                      <p className="mutado" style={{ margin: 0, fontSize: 14 }}>{c.horas} h · {c.area}</p>
                    </div>
                  </a>
                ))}
                <div style={{ border: "2px dashed #bdbdbd", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, boxSizing: "border-box", color: "var(--gray)", fontSize: 14 }}>
                  Os próximos cursos entram aqui conforme forem publicados na plataforma
                </div>
              </div>
              <div className="acoes">
                <a className="btn btn--escuro btn--bloco" href={`${EMPRESA.treinamentos}/cursos`}>Comprar na plataforma</a>
                <a className="btn btn--contorno btn--bloco" href={`${EMPRESA.treinamentos}/cursos`}>Ver todos os cursos</a>
              </div>
              <p className="aviso" style={{ margin: "24px 0 0" }}>
                <Info aria-hidden="true" size={20} style={{ flex: "none", marginTop: 1 }} />
                <span>{AVISO_CURSO_LIVRE}</span>
              </p>
            </div>
          </div>
        </section>

        {/* 12 Missão, visão e valores */}
        <section id="missao-visao-valores" className="secao" style={{ background: "#e3e3e3" }} aria-labelledby="mvv-titulo">
          <Tag>12 · Missão, visão e valores</Tag>
          <div className="container">
            <p className="kicker">Identidade</p>
            <h2 id="mvv-titulo" className="t2">Missão, visão e valores</h2>
            <p className="mutado" style={{ margin: "8px 0 0", fontSize: 14 }}>Fundo: IMG-17 · paisagem com indústria e vegetação, suave.</p>
            <div className="grade grade--3" style={{ marginTop: 40 }}>
              <Pilar rotulo="Missão">
                <p style={{ margin: 0 }}>Oferecer soluções técnicas e tecnológicas em SSMA e SGI que simplifiquem a gestão, fortaleçam a prevenção de riscos e apoiem o atendimento aos requisitos legais e normativos, promovendo ambientes de trabalho mais seguros, responsáveis e eficientes.</p>
              </Pilar>
              <Pilar rotulo="Visão">
                <p style={{ margin: 0 }}>Ser reconhecida nacionalmente como referência em soluções integradas de Segurança, Saúde, Meio Ambiente e Sistemas de Gestão, conectando empresas, profissionais qualificados e tecnologias inovadoras.</p>
              </Pilar>
              <Pilar rotulo="Valores">
                <ul style={{ margin: 0, padding: 0, listStyle: "none", lineHeight: 1.8 }}>{VALORES.map((v) => <li key={v}>{v}</li>)}</ul>
              </Pilar>
            </div>
          </div>
        </section>

        {/* 13 Fale conosco */}
        <section id="contato" className="secao" aria-labelledby="contato-titulo">
          <Tag>13 · Fale conosco</Tag>
          <div className="container grade grade--2 grade--meio">
            <div>
              <p className="kicker">Contato</p>
              <h2 id="contato-titulo" className="t2">Vamos organizar a segurança da sua empresa?</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28, maxWidth: 440 }}>
                <a className="btn btn--escuro btn--grande" href={whatsapp()} target="_blank" rel="noopener">WhatsApp {EMPRESA.telefone}</a>
                <a className="btn btn--contorno btn--grande" href={MAILTO}>{EMPRESA.email}</a>
              </div>
              <p className="mutado" style={{ margin: "20px 0 0", fontSize: 14, display: "flex", gap: 8 }}>
                <MapPin aria-hidden="true" size={18} style={{ flex: "none", marginTop: 2 }} />
                {EMPRESA.endereco}
              </p>
            </div>
            <Foto codigo="IMG-18" descricao="aperto de mãos entre profissional com capacete e gestor" className="foto--redonda" style={{ height: 320 }} />
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}

function CardVidro({ nome, texto, login }: { nome: string; texto: string; login: string }) {
  return (
    <div className="vidro">
      <LogoLugar nome={`Logo ${nome} negativo`} largura={320} altura={73} />
      <p style={{ fontSize: 13 }}>Uma solução AUDITA</p>
      <p style={{ fontSize: 14, lineHeight: 1.5 }}>{texto}</p>
      <p className="links">
        <a href="#plataformas">Conhecer</a>
        <a href={login} target="_blank" rel="noopener" className="externo" aria-label={`Acessar o ${nome} (abre em nova aba, área exclusiva para clientes)`}>
          Acessar
        </a>
      </p>
    </div>
  );
}

function Produto(p: { nome: string; fundo: string; contexto: string; texto: string; itens: string[]; img: string; foto: string; login: string }) {
  const icones = p.nome === "Audita PRO" ? [ClipboardCheck, ShieldCheck, MonitorSmartphone, GraduationCap] : [ShieldCheck, ClipboardCheck, Leaf, GraduationCap];
  return (
    <div style={{ background: p.fundo, padding: "64px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <p className="mutado" style={{ margin: "0 0 12px", fontSize: 13 }}>{p.contexto}</p>
        <h2 style={{ margin: 0 }}>
          <LogoLugar nome={`Logo ${p.nome}`} largura={320} altura={73} />
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{p.nome}</span>
        </h2>
        <p style={{ margin: "8px 0 20px", fontSize: 14 }}>Uma solução AUDITA</p>
        <p className="texto-grande" style={{ margin: 0 }}>{p.texto}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10 }}>
          {p.itens.map((item, i) => {
            const Icone = icones[i];
            return (
              <li key={item} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Icone aria-hidden="true" size={20} style={{ flex: "none" }} />
                {item}
              </li>
            );
          })}
        </ul>
        <Foto codigo={p.img} descricao={p.foto} className="foto--redonda" style={{ height: 220, marginTop: 28 }} />
        <div className="acoes" style={{ alignItems: "flex-start" }}>
          <a className="btn btn--escuro btn--bloco" href={whatsapp(`Olá! Quero conhecer o ${p.nome}.`)} target="_blank" rel="noopener">Quero conhecer</a>
          <span style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", maxWidth: 260 }}>
            <a className="btn btn--contorno externo" href={p.login} target="_blank" rel="noopener">Acessar</a>
            <span className="mutado" style={{ fontSize: 13 }}>Área exclusiva para clientes</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Pilar({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontSize: 15, lineHeight: 1.6 }}>
      <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", margin: 18 }}>
        <div style={{ position: "absolute", inset: 0, transform: "rotate(45deg)", border: "2px solid #5c5c5c", borderRadius: 16 }} />
        <h3 className="marca-texto" style={{ position: "relative", margin: 0, font: "700 20px/1.2 var(--font-display), Arial, sans-serif" }}>{rotulo}</h3>
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
