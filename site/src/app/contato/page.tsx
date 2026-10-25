import type { Metadata } from "next";
import { ExternalLink, GraduationCap, Mail, MapPin, MessageCircle, MonitorSmartphone } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { Foto } from "@/components/wireframe";
import { EMPRESA, whatsapp } from "@/content/empresa";
import { EmailTexto, LinkEmail } from "@/components/email";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a AUDITA pelo WhatsApp (15) 99689-1049 ou por e-mail. Sorocaba/SP.",
  alternates: { canonical: "/contato/" },
};

const MAPA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Rua Oswaldo de Barros, 219, Sorocaba - SP, 18079-026")}`;

/**
 * /contato: WhatsApp, e-mail, endereço e mapa (briefing, seção 8). Sem formulário na V1 (briefing 10.1). O mapa abre
 * no Google Maps em nova aba, em vez de um mapa embutido, para não carregar cookies de terceiros no site.
 */
export default function Contato() {
  return (
    <>
      <Cabecalho />
      <main>
        <HeroInterno
          id="contato-titulo"
          migalhas={[{ rotulo: "Contato" }]}
          kicker="Contato"
          titulo={<>Fale <span className="marca-texto">conosco</span></>}
          resumo="Vamos organizar a segurança da sua empresa? Converse com a AUDITA pelo WhatsApp ou por e-mail."
          foto={{ codigo: "IMG-27", descricao: "fachada ou ambiente de Sorocaba, ou foto industrial genérica" }}
        />

        <section className="secao" aria-label="Canais de contato">
          <div className="container grade grade--2">
            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <a className="card com-losango" href={whatsapp()} target="_blank" rel="noopener" style={{ textDecoration: "none", padding: 24, display: "flex", gap: 20, alignItems: "center" }}>
                <span className="losango" aria-hidden="true"><MessageCircle /></span>
                <span>
                  <span className="t3" style={{ display: "block" }}>WhatsApp</span>
                  <span style={{ fontSize: 18 }}>{EMPRESA.telefone}</span>
                  <span className="mutado" style={{ display: "block", fontSize: 14 }}>Abre o WhatsApp com uma mensagem pronta</span>
                </span>
              </a>
              <LinkEmail className="card com-losango" style={{ textDecoration: "none", padding: 24, display: "flex", gap: 20, alignItems: "center" }}>
                <span className="losango" aria-hidden="true"><Mail /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="t3" style={{ display: "block" }}>E-mail</span>
                  <span style={{ fontSize: 17, overflowWrap: "anywhere" }}><EmailTexto /></span>
                </span>
              </LinkEmail>
              <a className="card com-losango" href={MAPA} target="_blank" rel="noopener" style={{ textDecoration: "none", padding: 24, display: "flex", gap: 20, alignItems: "center" }}>
                <span className="losango" aria-hidden="true"><MapPin /></span>
                <span>
                  <span className="t3" style={{ display: "block" }}>Endereço</span>
                  <span>{EMPRESA.endereco}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--green-text)", marginTop: 6 }}>
                    Abrir no mapa <ExternalLink aria-hidden="true" size={16} />
                  </span>
                </span>
              </a>
              <p className="mutado" style={{ margin: "8px 0 0", fontSize: 14 }}>
                CNPJ {EMPRESA.cnpj} · Atuação inicial no estado de São Paulo, com sede em Sorocaba.
              </p>
            </div>
            <Foto codigo="IMG-18" descricao="aperto de mãos entre profissional com capacete e gestor" className="foto--redonda" style={{ minHeight: 360 }} />
          </div>
        </section>

        <section className="secao secao--cinza" aria-labelledby="acessos-titulo">
          <div className="container">
            <h2 id="acessos-titulo" className="t3">Já é cliente ou aluno?</h2>
            <div className="grade grade--3" style={{ marginTop: 20 }}>
              {[
                { rotulo: "Acessar o Audita PRO", nota: "Área exclusiva para clientes", href: EMPRESA.proLogin, Icone: MonitorSmartphone, externo: true },
                { rotulo: "Acessar o Audita HUB", nota: "Área exclusiva para clientes", href: EMPRESA.hubLogin, Icone: MonitorSmartphone, externo: true },
                { rotulo: "Plataforma de cursos EAD", nota: "Entrar, comprar cursos e emitir certificados", href: EMPRESA.treinamentos, Icone: GraduationCap, externo: false },
              ].map(({ rotulo, nota, href, Icone, externo }) => (
                <a key={rotulo} className="card" href={href} {...(externo ? { target: "_blank", rel: "noopener" } : {})} style={{ textDecoration: "none", padding: 20, display: "flex", gap: 14, alignItems: "center" }}>
                  <Icone aria-hidden="true" style={{ color: "var(--green-text)", flex: "none" }} />
                  <span>
                    <span className={externo ? "externo" : undefined} style={{ fontWeight: 700 }}>{rotulo}</span>
                    <span className="mutado" style={{ display: "block", fontSize: 14 }}>{nota}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
