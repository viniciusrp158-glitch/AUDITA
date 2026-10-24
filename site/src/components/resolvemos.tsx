"use client";

import { useState } from "react";
import { Carrossel } from "./carrossel";
import { Foto } from "./wireframe";

/** Seção 8 "O que resolvemos": carrossel das 8 necessidades (briefing 4.5); o fundo troca com fade conforme o card ativo. */
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

export function Resolvemos() {
  const [ativo, setAtivo] = useState(0);
  return (
    <section className="secao secao--escura" style={{ overflow: "hidden" }} aria-labelledby="resolvemos-titulo">
      <div className="fundos" aria-hidden="true">
        {NECESSIDADES.map((n, i) => (
          <Foto key={n.img} codigo={`${n.img} (fundo)`} descricao={n.foto} className={i === ativo ? "foto--escura ativo" : "foto--escura"} style={{ alignItems: "flex-end", justifyContent: "flex-start", padding: "20px 24px", flexDirection: "row" }} />
        ))}
      </div>
      <div className="container" style={{ position: "relative" }}>
        <p className="kicker">O que resolvemos</p>
        <h2 id="resolvemos-titulo" className="t2" style={{ maxWidth: "18ch" }}>
          A AUDITA atende empresas de <span className="marca-texto">todos os segmentos</span>.
        </h2>
        <div style={{ marginTop: 40 }}>
          <Carrossel rotulo="O que resolvemos" escuro aoMudar={setAtivo}>
            {NECESSIDADES.map((n, i) => (
              <div key={n.texto} className={i === ativo ? "slide-card slide-card--ativo" : "slide-card"}>
                <Foto codigo={n.img} descricao={n.foto} style={{ height: 160, borderRadius: 8 }} />
                <p className="t3" style={{ marginTop: 16, fontSize: 20 }}>{n.texto}</p>
              </div>
            ))}
          </Carrossel>
        </div>
      </div>
    </section>
  );
}
