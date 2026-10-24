import { ImageIcon } from "lucide-react";

/**
 * Peças de apoio da prévia: rótulo de seção (só no wireframe da Etapa 2), imagem provisória com o código IMG-xx do
 * briefing (o Diretor escolhe as definitivas), a curva verde e os logotipos oficiais.
 */
export const WIREFRAME = false;

export function Tag({ children }: { children: React.ReactNode }) {
  if (!WIREFRAME) return null;
  return (
    <span className="wf-tag" aria-hidden="true">
      {children}
    </span>
  );
}

export function Foto({ codigo, descricao, className = "", style }: { codigo: string; descricao: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`foto ${className}`} style={style} role="img" aria-label={`Imagem provisória ${codigo}: ${descricao}`}>
      <ImageIcon aria-hidden="true" />
      <span className="foto__codigo">{codigo}</span>
      <span>{descricao}</span>
    </div>
  );
}

/** Curva verde ampla na base de uma foto; `cor` é o fundo da seção seguinte. */
export function Curva({ cor = "var(--white)" }: { cor?: string }) {
  return (
    <svg className="curva" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 80 V58 C 420 2, 980 2, 1440 40 V80 Z" fill={cor} />
      <path d="M0 52 C 420 -4, 980 -4, 1440 34" fill="none" stroke="var(--green)" strokeWidth={8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Logotipos aprovados (AUDDOC003): nunca recolorir, esticar ou aplicar sombra. Largura mínima 180 px (AUDITA) e 320 px (PRO/HUB). */
const LOGOS = {
  "audita-negativa": { alt: "AUDITA", w: 180, h: 63 },
  "audita-positiva": { alt: "AUDITA", w: 180, h: 63 },
  "pro-negativa": { alt: "Audita PRO", w: 320, h: 73 },
  "hub-negativa": { alt: "Audita HUB", w: 320, h: 74 },
  pro: { alt: "Audita PRO", w: 320, h: 73 },
  hub: { alt: "Audita HUB", w: 320, h: 74 },
} as const;

export function Logo({ nome, alt, className = "" }: { nome: keyof typeof LOGOS; alt?: string; className?: string }) {
  const l = LOGOS[nome];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- site estático (export), imagem já otimizada em WebP
    <img className={`logo ${className}`} src={`/images/marca/${nome}.webp`} alt={alt ?? l.alt} width={l.w} height={l.h} />
  );
}
