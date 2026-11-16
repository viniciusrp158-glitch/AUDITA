/**
 * Marca da plataforma, Audita Academy (logo enviado pelo Diretor em 16/11/2026; versões aprovadas sem redesenho).
 * "clara" para fundo claro; "escura" para fundo azul-marinho ou foto (letras brancas, verde mantido).
 */
export function AcademyLogo({ variant = "clara", height = 40 }: { variant?: "clara" | "escura"; height?: number }) {
  const width = Math.round((height * 640) / 228);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/treinamentos/brand/audita-academy-${variant === "escura" ? "negativa" : "positiva"}.webp`}
      alt="Audita Academy"
      width={width}
      height={height}
      className="block shrink-0"
      style={{ width, height }}
    />
  );
}
