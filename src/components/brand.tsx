import Image from "next/image";

/**
 * Logotipo oficial (arquivo original preservado em /public/brand). Apenas recorte de exibição
 * das margens brancas do PNG; nenhuma alteração de cor, proporção ou desenho (AUDDOC003).
 */
// Área útil do PNG oficial (1920×1080): x 190–1710, y 215–745 (inclui a folha e respiro mínimo).
const CROP = { x: 190, y: 215, w: 1520, h: 530 };

export function Logo({ width = 132 }: { width?: number }) {
  const s = width / CROP.w;
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden"
      style={{ width, height: Math.round(CROP.h * s) }}
    >
      <Image
        src="/brand/audita-logo.png"
        alt="AUDITA"
        width={1920}
        height={1080}
        priority
        style={{
          position: "absolute",
          maxWidth: "none",
          width: Math.round(1920 * s),
          height: Math.round(1080 * s),
          left: -Math.round(CROP.x * s),
          top: -Math.round(CROP.y * s),
        }}
      />
    </span>
  );
}

export function Signature() {
  return <span className="text-xs tracking-wide text-muted">AUDITA | SSMA &amp; SGI</span>;
}

export function EnvBadge() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "producao") return null;
  return (
    <div
      role="status"
      className="bg-warn px-4 py-1 text-center text-xs font-semibold tracking-wide text-white"
    >
      AMBIENTE DE DESENVOLVIMENTO — SOMENTE DADOS FICTÍCIOS
    </div>
  );
}
