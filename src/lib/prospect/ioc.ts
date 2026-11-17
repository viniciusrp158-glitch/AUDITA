/**
 * Índice de Oportunidade Comercial (IOC) por município — AUDDOC020 RP-14. Arquivo puro (servidor e testes).
 * Critérios da versão "v1" (planejamento aprovado em 14/11/2026, seção 17): quantidade de empresas-alvo dos nichos
 * escolhidos (30, escala logarítmica em relação ao maior município do recorte), concentração desses nichos entre as
 * empresas-alvo do município (20, em relação à maior concentração) e distância da sede (10, zero a partir de 150 km).
 * Canal de contato e histórico de conversão entram quando houver dados; até lá o resultado é normalizado para 0–100.
 */

export const IOC_VERSION = "v1";
export const IOC_WEIGHTS = { quantidade: 30, concentracao: 20, distancia: 10 } as const;
const TOTAL = IOC_WEIGHTS.quantidade + IOC_WEIGHTS.concentracao + IOC_WEIGHTS.distancia;
export const DISTANCE_ZERO_KM = 150;

export type RegionInput = { ibge: string; name: string; km: number | null; byNiche: Record<string, number>; allTargets: number };
export type RegionScore = RegionInput & {
  selected: number;
  share: number;
  ioc: number;
  parts: { quantidade: number; concentracao: number; distancia: number };
};

/** Calcula o IOC dos municípios para os nichos escolhidos; municípios sem empresa dos nichos ficam de fora. */
export function computeIoc(regions: RegionInput[], nicheIds: string[]): RegionScore[] {
  const base = regions
    .map((r) => {
      const selected = nicheIds.reduce((s, id) => s + (r.byNiche[id] ?? 0), 0);
      return { ...r, selected, share: r.allTargets ? selected / r.allTargets : 0 };
    })
    .filter((r) => r.selected > 0);
  if (!base.length) return [];
  const maxSel = Math.max(...base.map((r) => r.selected));
  const maxShare = Math.max(...base.map((r) => r.share));
  return base
    .map((r) => {
      const q = maxSel > 1 ? Math.log(r.selected) / Math.log(maxSel) : 1;
      const c = maxShare > 0 ? r.share / maxShare : 0;
      const d = r.km === null ? 0 : Math.max(0, 1 - r.km / DISTANCE_ZERO_KM);
      const parts = {
        quantidade: round1(IOC_WEIGHTS.quantidade * q),
        concentracao: round1(IOC_WEIGHTS.concentracao * c),
        distancia: round1(IOC_WEIGHTS.distancia * d),
      };
      const ioc = Math.round(((IOC_WEIGHTS.quantidade * q + IOC_WEIGHTS.concentracao * c + IOC_WEIGHTS.distancia * d) / TOTAL) * 100);
      return { ...r, parts, ioc };
    })
    .sort((a, b) => b.ioc - a.ioc || b.selected - a.selected || a.name.localeCompare(b.name, "pt-BR"));
}

const round1 = (n: number) => Math.round(n * 10) / 10;
