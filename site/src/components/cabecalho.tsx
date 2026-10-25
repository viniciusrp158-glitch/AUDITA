"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { EMPRESA, MAILTO, whatsapp } from "@/content/empresa";
import { MENU } from "@/content/navegacao";
import { Logo } from "./wireframe";
import { EmailTexto } from "./email";

/**
 * Barra superior + header. No topo fica transparente sobre a foto do hero (logo negativo); ao rolar vira branco e
 * fixo (logo original) e a barra superior some. Dropdowns abrem por clique ou teclado; no celular, menu em tela cheia.
 */
export function Cabecalho({ ativo }: { ativo?: string }) {
  const [rolado, setRolado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [celular, setCelular] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const aoRolar = () => setRolado(window.scrollY > 140);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setAberto(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(null);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  useEffect(() => {
    document.body.style.overflow = celular ? "hidden" : "";
    if (!celular) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCelular(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [celular]);

  return (
    <>
      <header className={rolado ? "cab cab--rolado" : "cab"}>
        <p className="previa">Prévia do site em construção · Etapa 4</p>
        <div className="topo">
          <div className="container topo__linha">
            <a href={whatsapp()} target="_blank" rel="noopener">
              <MessageCircle aria-hidden="true" size={16} /> WhatsApp {EMPRESA.telefone}
            </a>
            <a className="topo__email" href={MAILTO}>
              <EmailTexto />
            </a>
            <span className="topo__dir">
              <a href={EMPRESA.proLogin} target="_blank" rel="noopener" className="externo">
                Acessar Audita PRO
              </a>
              <a href={EMPRESA.hubLogin} target="_blank" rel="noopener" className="externo">
                Acessar Audita HUB
              </a>
              <a href={EMPRESA.treinamentos}>Treinamentos EAD</a>
            </span>
          </div>
        </div>
        <div className="container cab__linha">
          <Link href="/" className="cab__logo" aria-label="AUDITA, página inicial">
            <Logo nome={rolado ? "audita-positiva" : "audita-negativa"} alt="" />
          </Link>
          <nav ref={navRef} aria-label="Principal">
            {MENU.map((grupo) => {
              const id = `menu-${grupo.rotulo.toLowerCase().replace(/\W+/g, "-")}`;
              const estaAberto = aberto === grupo.rotulo;
              return (
                <div
                  key={grupo.rotulo}
                  className="menu-grupo"
                  onMouseEnter={() => setAberto(grupo.rotulo)}
                  onMouseLeave={() => setAberto(null)}
                >
                  <button
                    type="button"
                    className={ativo === grupo.rotulo ? "menu-botao menu-botao--ativo" : "menu-botao"}
                    aria-expanded={estaAberto}
                    aria-controls={id}
                    // Com o mouse o painel já abriu no hover: o clique o mantém aberto. Pelo teclado (detail 0), alterna.
                    onClick={(e) => setAberto(e.detail === 0 && estaAberto ? null : grupo.rotulo)}
                  >
                    {grupo.rotulo} <ChevronDown aria-hidden="true" />
                  </button>
                  {estaAberto &&
                    (grupo.rotulo === "Plataformas" ? (
                      <div id={id} className="menu-painel menu-painel--mega">
                        <MegaItem nome="Audita PRO" texto="Auditorias e documentos de SSMA e SGI, acompanhados em tempo real." login={EMPRESA.proLogin} />
                        <MegaItem nome="Audita HUB" texto="A rotina de SSMA da sua empresa em um só lugar." login={EMPRESA.hubLogin} />
                      </div>
                    ) : (
                      <div id={id} className="menu-painel">
                        {grupo.itens.map((item) => (
                          <a key={item.rotulo} href={item.href} onClick={() => setAberto(null)}>
                            {item.rotulo}
                          </a>
                        ))}
                      </div>
                    ))}
                </div>
              );
            })}
            <Link className="btn btn--principal" href="/contato/">
              Fale conosco
            </Link>
          </nav>
          <button type="button" className="hamburguer" aria-label="Abrir menu" aria-expanded={celular} onClick={() => setCelular(true)}>
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>
      {celular && <MenuCelular fechar={() => setCelular(false)} />}
    </>
  );
}

function MegaItem({ nome, texto, login }: { nome: string; texto: string; login: string }) {
  return (
    <div className={nome === "Audita PRO" ? "mega-item" : "mega-item mega-item--hub"}>
      <Logo nome={nome === "Audita PRO" ? "pro" : "hub"} />
      <p>{texto}</p>
      <p className="links">
        <Link href={nome === "Audita PRO" ? "/audita-pro/" : "/audita-hub/"}>Conhecer o {nome}</Link>
        <a href={login} target="_blank" rel="noopener" className="externo">
          Acessar
        </a>
      </p>
      <p className="mutado" style={{ fontSize: 12 }}>
        &quot;Acessar&quot; abre o login em nova aba: área exclusiva para clientes.
      </p>
    </div>
  );
}

function MenuCelular({ fechar }: { fechar: () => void }) {
  const [grupo, setGrupo] = useState<string | null>(null);
  return (
    <div className="menu-cel" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="container menu-cel__topo">
        <Logo nome="audita-negativa" />
        <button type="button" className="hamburguer" style={{ marginLeft: 0 }} aria-label="Fechar menu" onClick={fechar} autoFocus>
          <X aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Principal">
        {MENU.map((g) => {
          const aberto = grupo === g.rotulo;
          return (
            <div key={g.rotulo} className="menu-cel__grupo">
              <button type="button" className="menu-cel__botao" aria-expanded={aberto} onClick={() => setGrupo(aberto ? null : g.rotulo)}>
                {g.rotulo} <span aria-hidden="true">{aberto ? "−" : "+"}</span>
              </button>
              {aberto && (
                <div className="menu-cel__itens">
                  {g.itens.map((item) => (
                    <a key={item.rotulo} href={item.href} onClick={fechar}>
                      {item.rotulo}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 20, fontSize: 14 }}>
          <a href={EMPRESA.proLogin} target="_blank" rel="noopener" className="externo">
            Acessar Audita PRO
          </a>
          <a href={EMPRESA.hubLogin} target="_blank" rel="noopener" className="externo">
            Acessar Audita HUB
          </a>
          <a href={EMPRESA.treinamentos}>Treinamentos EAD</a>
        </p>
      </nav>
      <div className="menu-cel__rodape">
        <a className="btn btn--principal btn--grande" style={{ display: "flex", width: "100%" }} href={whatsapp()} target="_blank" rel="noopener">
          <MessageCircle aria-hidden="true" size={20} /> WhatsApp {EMPRESA.telefone}
        </a>
      </div>
    </div>
  );
}
