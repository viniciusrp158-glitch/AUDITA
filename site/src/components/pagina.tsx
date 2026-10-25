import Link from "next/link";
import { whatsapp } from "@/content/empresa";
import { Curva } from "./wireframe";
import { imagemDefinitiva } from "@/lib/imagens";
import { LinkEmail } from "./email";

/**
 * Peças das páginas internas (briefing, seção 9 "Páginas internas"): hero menor com foto e curva verde na base,
 * migalhas, título com marca-texto e a chamada de contato do fim.
 */
export function HeroInterno({
  id,
  migalhas,
  kicker,
  titulo,
  resumo,
  foto,
  traco,
  children,
}: {
  id: string;
  migalhas: { rotulo: string; href?: string }[];
  kicker: string;
  titulo: React.ReactNode;
  resumo?: string;
  foto: { codigo: string; descricao: string; src?: string };
  traco?: string;
  children?: React.ReactNode;
}) {
  const definitiva = foto.src ? undefined : imagemDefinitiva(foto.codigo);
  const fundo = foto.src ?? definitiva;
  return (
    <section className="hero hero--interna" aria-labelledby={id}>
      {fundo ? (
        <div className="hero__foto" aria-hidden="true" style={{ padding: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- site estático, imagem já em WebP */}
          <img src={fundo} alt="" fetchPriority={definitiva ? "high" : "low"} decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: definitiva ? "center" : "top" }} />
          {/* Tela de sistema ao fundo: quase toda coberta; foto definitiva: camada navy do guia (photo-overlay) */}
          <span style={{ position: "absolute", inset: 0, background: definitiva ? "var(--photo-overlay)" : "rgba(3, 27, 53, 0.92)" }} />
        </div>
      ) : (
        <div className="hero__foto" aria-hidden="true">
          <span style={{ fontWeight: 700 }}>{foto.codigo} · imagem provisória</span>
          <span>{foto.descricao}</span>
        </div>
      )}
      <div className="container" style={{ position: "relative" }}>
        <nav aria-label="Você está em" className="migalhas">
          <Link href="/">Início</Link>
          {migalhas.map((m) => (
            <span key={m.rotulo} style={{ display: "contents" }}>
              <span aria-hidden="true">›</span>
              {m.href ? <Link href={m.href}>{m.rotulo}</Link> : <span aria-current="page">{m.rotulo}</span>}
            </span>
          ))}
        </nav>
        <p className="kicker">{kicker}</p>
        <h1 id={id} className="t1" style={{ maxWidth: "18ch" }}>{titulo}</h1>
        {resumo ? <p className="texto-grande medida" style={{ margin: "20px 0 0" }}>{resumo}</p> : null}
        {children}
      </div>
      <Curva traco={traco} />
    </section>
  );
}

export function ChamadaContato({ mensagem }: { mensagem?: string }) {
  return (
    <section className="secao secao--escura" style={{ paddingTop: 56, paddingBottom: 56 }} aria-labelledby="cta-titulo">
      <div className="container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
        <h2 id="cta-titulo" className="t2" style={{ flex: "1 1 420px" }}>Vamos organizar a segurança da sua empresa?</h2>
        <div className="acoes" style={{ marginTop: 0 }}>
          <a className="btn btn--principal btn--grande btn--bloco" href={whatsapp(mensagem)} target="_blank" rel="noopener">Fale pelo WhatsApp</a>
          <LinkEmail className="btn btn--contorno-claro btn--grande btn--bloco">Enviar e-mail</LinkEmail>
        </div>
      </div>
    </section>
  );
}
