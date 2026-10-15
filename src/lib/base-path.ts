/**
 * Endereço do sistema: audita.seg.br/empresa (caderno I2.01, decisão do Diretor de 14/10/2026).
 * A raiz audita.seg.br fica reservada ao site institucional; enquanto ele não existir, a raiz leva ao sistema.
 * Links do Next (<Link>, redirect, router) já recebem o prefixo; use withBase() só em <a href>, <img> e URLs absolutas.
 */
export const BASE_PATH = "/empresa";

export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
