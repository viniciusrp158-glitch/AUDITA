"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CLARITY_ID } from "@/content/empresa";

/**
 * Microsoft Clarity (pedido do Diretor, 24/11/2026): mapa de cliques e rolagem para entender o uso do site.
 * Só carrega depois que o visitante aceita (LGPD). Sem CLARITY_ID, nada aparece e nada é carregado.
 * A escolha fica no navegador do visitante (localStorage) e pode ser trocada em /privacidade/.
 */
const CHAVE = "audita-medicao";

function carregarClarity(id: string) {
  const w = window as unknown as { clarity?: ((...a: unknown[]) => void) & { q?: unknown[] } };
  if (w.clarity) return;
  const fila = ((...a: unknown[]) => {
    (fila.q = fila.q || []).push(a);
  }) as ((...a: unknown[]) => void) & { q?: unknown[] };
  w.clarity = fila;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${id}`;
  document.head.appendChild(s);
  w.clarity("consent");
}

function lerEscolha(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function gravarEscolha(valor: "aceito" | "recusado") {
  try {
    window.localStorage.setItem(CHAVE, valor);
  } catch {
    /* navegador sem armazenamento: a pergunta volta na próxima visita */
  }
  if (valor === "aceito" && CLARITY_ID) carregarClarity(CLARITY_ID);
  const w = window as unknown as { clarity?: (...a: unknown[]) => void };
  if (valor === "recusado" && w.clarity) w.clarity("consent", false);
  window.dispatchEvent(new Event("audita-medicao"));
}

export function Medicao() {
  const [perguntar, setPerguntar] = useState(false);
  useEffect(() => {
    if (!CLARITY_ID) return;
    const atualizar = () => {
      const escolha = lerEscolha();
      if (escolha === "aceito") carregarClarity(CLARITY_ID);
      setPerguntar(escolha === null);
    };
    atualizar();
    window.addEventListener("audita-medicao", atualizar);
    return () => window.removeEventListener("audita-medicao", atualizar);
  }, []);
  if (!CLARITY_ID || !perguntar) return null;
  return (
    <div className="aviso-medicao" role="region" aria-label="Medição de uso do site">
      <p>
        Usamos o Microsoft Clarity para entender como o site é usado (cliques e rolagem), sem pedir dados pessoais.{" "}
        <Link href="/privacidade/">Saiba mais</Link>
      </p>
      <div className="aviso-medicao__botoes">
        <button type="button" className="btn btn--principal" onClick={() => gravarEscolha("aceito")}>
          Aceitar
        </button>
        <button type="button" className="btn btn--contorno" onClick={() => gravarEscolha("recusado")}>
          Recusar
        </button>
      </div>
    </div>
  );
}

/** Botão da política de privacidade para rever a escolha. */
export function TrocarEscolha() {
  const [escolha, setEscolha] = useState<string | null>(null);
  useEffect(() => {
    const ler = () => setEscolha(lerEscolha());
    ler();
    window.addEventListener("audita-medicao", ler);
    return () => window.removeEventListener("audita-medicao", ler);
  }, []);
  if (!CLARITY_ID) return null;
  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span>Sua escolha neste navegador: {escolha === "aceito" ? "aceita" : escolha === "recusado" ? "recusada" : "ainda não feita"}.</span>
      <button type="button" className="btn btn--contorno" onClick={() => gravarEscolha(escolha === "aceito" ? "recusado" : "aceito")}>
        {escolha === "aceito" ? "Recusar a medição" : "Aceitar a medição"}
      </button>
    </span>
  );
}
