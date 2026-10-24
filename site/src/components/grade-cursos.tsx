"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Foto } from "./wireframe";
import type { Curso } from "@/content/cursos";

const AREAS = ["Todas", "Segurança", "Saúde", "Meio Ambiente", "SGI"] as const;

/** Grade de cursos publicados com filtro por área (briefing: /cursos). Cada card leva ao curso na plataforma. */
export function GradeCursos({ cursos }: { cursos: Curso[] }) {
  const [area, setArea] = useState<(typeof AREAS)[number]>("Todas");
  const lista = area === "Todas" ? cursos : cursos.filter((c) => c.area === area);
  return (
    <div>
      <div role="group" aria-label="Filtrar por área" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={a === area}
            onClick={() => setArea(a)}
            className={a === area ? "btn btn--escuro" : "btn btn--contorno"}
            style={{ minHeight: 44, padding: "0 18px" }}
          >
            {a}
          </button>
        ))}
      </div>
      <p className="mutado" aria-live="polite" style={{ margin: "16px 0 0", fontSize: 14 }}>
        {lista.length === 1 ? "1 curso publicado" : `${lista.length} cursos publicados`}
        {area === "Todas" ? "" : ` em ${area}`}
      </p>
      {lista.length ? (
        <ul className="grade grade--3" style={{ listStyle: "none", padding: 0, margin: "20px 0 0" }}>
          {lista.map((c) => (
            <li key={c.codigo}>
              <a className="card" href={`/treinamentos/cursos/${c.codigo}`} style={{ display: "block", textDecoration: "none", height: "100%" }}>
                <div style={{ overflow: "hidden" }}>
                  <Foto codigo={`Capa ${c.codigo}`} descricao="capa do curso (padrão AUDITA, a enviar)" className="zoom" style={{ height: 180 }} />
                </div>
                <div className="card__corpo">
                  <span className="mutado" style={{ fontSize: 13, fontWeight: 600 }}>{c.area}</span>
                  <span style={{ fontWeight: 700, lineHeight: 1.35 }}>{c.titulo}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                    <Clock aria-hidden="true" size={16} /> {c.horas} h
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--green-text)" }}>Ver curso na plataforma</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="aviso" style={{ margin: "20px 0 0" }}>Ainda não há curso publicado nesta área. Novos cursos aparecem aqui assim que forem publicados na plataforma.</p>
      )}
    </div>
  );
}
