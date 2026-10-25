import { EMPRESA, MAILTO, REDES_SOCIAIS, REDES_SOCIAIS_PUBLICADAS, whatsapp } from "@/content/empresa";
import Link from "next/link";
import { MENU } from "@/content/navegacao";
import { imagemDefinitiva } from "@/lib/imagens";
import { Foto, Logo, Tag } from "./wireframe";

/** Rodapé (seção 14): dados oficiais, links, endosso dos produtos e o diagrama do ecossistema AUDITA. */
export function Rodape() {
  const [aAudita, solucoes] = MENU;
  return (
    <footer className="rodape">
      <Tag>14 · Rodapé</Tag>
      <Foto codigo="IMG-19" descricao="foto aérea de área industrial com vegetação, escurecida" className="foto--escura" style={{ position: "absolute", inset: 0, background: "var(--navy)", color: "rgba(255,255,255,0.45)", alignItems: "flex-end", justifyContent: "flex-start", padding: "16px 24px", flexDirection: "row" }} />
      {imagemDefinitiva("IMG-19") ? <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(3, 27, 53, 0.85)" }} /> : null}
      <div className="container rodape__grade">
        <div>
          <Logo nome="audita-negativa" />
          <p style={{ margin: "16px 0 0", fontWeight: 600 }}>{EMPRESA.slogan}</p>
          <address style={{ fontStyle: "normal", margin: "16px 0 0", fontSize: 14, lineHeight: 1.7, color: "#e6e6e6" }}>
            <a href={whatsapp()} target="_blank" rel="noopener">WhatsApp {EMPRESA.telefone}</a>
            <br />
            <a href={MAILTO}>{EMPRESA.email}</a>
            <br />
            {EMPRESA.endereco}
            <br />
            CNPJ {EMPRESA.cnpj}
          </address>
        </div>
        <div className="rodape__links">
          <div>
            <h2>{aAudita.rotulo}</h2>
            <ul>{aAudita.itens.map((i) => <li key={i.rotulo}><a href={i.href}>{i.rotulo}</a></li>)}</ul>
          </div>
          <div>
            <h2>{solucoes.rotulo}</h2>
            <ul>{solucoes.itens.map((i) => <li key={i.rotulo}><a href={i.href}>{i.rotulo}</a></li>)}</ul>
          </div>
          <div>
            <h2>Plataformas e cursos</h2>
            <ul>
              <li><Link href="/audita-pro/">Audita PRO — Uma solução AUDITA</Link></li>
              <li><Link href="/audita-hub/">Audita HUB — Uma solução AUDITA</Link></li>
              <li><Link href="/cursos/">Cursos EAD</Link></li>
              <li><a href={EMPRESA.treinamentos}>Acessar a plataforma de cursos</a></li>
            </ul>
          </div>
        </div>
        <div className="ecossistema" role="img" aria-label="Ecossistema AUDITA: SST, Meio Ambiente, SGI, Cursos EAD, Audita PRO e Audita HUB em volta da AUDITA">
          <div className="ecossistema__anel" />
          <div className="ecossistema__centro">AUDITA</div>
          <span style={{ left: 134, top: 12 }}>SST</span>
          <span style={{ left: 214, top: 70 }}>Meio Ambiente</span>
          <span style={{ left: 250, top: 196 }}>SGI</span>
          <span style={{ left: 112, top: 270 }}>Cursos EAD</span>
          <span style={{ left: 0, top: 196 }}>Audita PRO</span>
          <span style={{ left: 0, top: 70 }}>Audita HUB</span>
        </div>
      </div>
      <div className="container rodape__base">
        <span>© {EMPRESA.assinatura} · CNPJ {EMPRESA.cnpj}</span>
        <Link href="/privacidade/">Política de privacidade</Link>
        <Link href="/contato/">Contato</Link>
        {REDES_SOCIAIS_PUBLICADAS ? (
          <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8 }} aria-label="Redes sociais">
            {REDES_SOCIAIS.filter((r) => r.url).map((r) => (
              <a key={r.nome} href={r.url} target="_blank" rel="noopener" className="externo" style={{ border: "1px solid rgba(255,255,255,0.4)", borderRadius: 999, padding: "4px 12px", textDecoration: "none" }}>
                {r.nome}
              </a>
            ))}
          </span>
        ) : null}
      </div>
    </footer>
  );
}
