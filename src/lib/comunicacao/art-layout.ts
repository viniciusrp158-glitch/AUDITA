/**
 * C1 — Divisão das peças com arte da IA: faixa branca com o logo oficial (topo), arte da IA (meio) e rodapé
 * azul-marinho com a assinatura, o slogan e os contatos oficiais (base). Topo e rodapé são sempre do sistema.
 * Módulo sem dependências de servidor.
 */
import { TEMPLATES, type Template } from "./labels";

export function artBands(template: Template): { width: number; height: number; header: number; footer: number } {
  const t = TEMPLATES[template];
  const m = Math.min(t.width, t.height);
  return { width: t.width, height: t.height, header: Math.round(m * 0.15), footer: Math.round(m * 0.11) };
}

/** Área (px) que a IA desenha. */
export function artArea(template: Template): { width: number; height: number } {
  const b = artBands(template);
  return { width: b.width, height: b.height - b.header - b.footer };
}
