/**
 * Peças da Etapa 2 (wireframe): rótulo de seção com o número do briefing, imagem provisória com o código IMG-xx e
 * a curva da linguagem visual. Saem ou mudam de cor na Etapa 3.
 */
export const WIREFRAME = true;

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
      {codigo} · {descricao}
    </div>
  );
}

/** Curva ampla na base de uma foto; `cor` é o fundo da seção seguinte. */
export function Curva({ cor = "var(--white)", traco = "#bdbdbd" }: { cor?: string; traco?: string }) {
  return (
    <svg className="curva" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 80 V58 C 420 2, 980 2, 1440 40 V80 Z" fill={cor} />
      <path d="M0 52 C 420 -4, 980 -4, 1440 34" fill="none" stroke={traco} strokeWidth={8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LogoLugar({ nome, largura = 180, altura = 63 }: { nome: string; largura?: number; altura?: number }) {
  return (
    <span className="logo-lugar" style={{ width: largura, height: altura, maxWidth: "100%" }}>
      {nome}
    </span>
  );
}
