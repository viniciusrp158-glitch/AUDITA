/**
 * Painel principal da home (estilo Ambipar): fotos que se alternam no fundo do hero, depois da IMG-01.
 * Arquivos em site/public/images/site/painel. Decisão do Diretor (07/11/2026): ambientes e paisagens em destaque, pessoas
 * só de costas (sem rosto) e a logo oficial da AUDITA aplicada nos uniformes (arquivo do AUDDOC003, sem alteração).
 * Para tirar uma foto do rodízio, apague a linha; a ordem aqui é a ordem de exibição.
 */
export const PAINEL: { src: string; descricao: string; foco?: string }[] = [
  { src: "/images/site/painel/painel-1.webp", descricao: "Planta industrial ao entardecer com técnico na passarela protegida", foco: "30% 50%" },
  { src: "/images/site/painel/painel-2.webp", descricao: "Centro de distribuição com profissional de costas, uniforme AUDITA", foco: "50% 45%" },
  { src: "/images/site/painel/painel-3.webp", descricao: "Técnico de segurança de costas observando obra com andaimes protegidos", foco: "25% 50%" },
  { src: "/images/site/painel/painel-4.webp", descricao: "Indústria integrada à natureza, com mata e rio", foco: "40% 50%" },
  { src: "/images/site/painel/painel-5.webp", descricao: "Trabalho em altura com cinto e talabarte ancorados na linha de vida", foco: "40% 50%" },
];

/** Tempo de cada foto no painel, em milissegundos. */
export const PAINEL_INTERVALO = 7000;
