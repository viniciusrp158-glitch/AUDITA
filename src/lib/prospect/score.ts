/**
 * Qualificação de empresas do AUDITA PROSPECT (AUDDOC020 RP-06): nota de 0 a 100 por regras explicáveis, sem IA.
 * Pesos da versão "v1" propostos no planejamento aprovado em 14/11/2026 (a calibrar com o histórico real).
 * Os serviços sugeridos são HIPÓTESES pelo segmento, nunca necessidades confirmadas, e só entram serviços liberados.
 * Arquivo puro (sem banco), para ser usado no servidor e nos testes.
 */

export const SCORE_VERSION = "v1";

export type Niche = { id: string; code: string; name: string; cnaePrefixes: string[]; serviceCodes: string[]; isEntry: boolean };

export type Company = {
  cnaeMain: string;
  cnaeSecondary: string[];
  sizeCode: "01" | "03" | "05";
  startedOn: string | null; // AAAA-MM-DD
  kmFromBase: number | null;
  hasPhone: boolean;
  hasEmail: boolean;
};

export type ScoreItem = { key: string; label: string; points: number; max: number; text: string };
export type ScoreBand = "prioritario" | "alto" | "intermediario" | "baixo";
export type Score = { score: number; band: ScoreBand; items: ScoreItem[]; niche: Niche | null; suggestedServices: string[]; version: string };

export const BAND_LABEL: Record<ScoreBand, string> = {
  prioritario: "Lead prioritário",
  alto: "Alto potencial",
  intermediario: "Potencial intermediário",
  baixo: "Baixo potencial",
};
export const SIZE_LABEL: Record<Company["sizeCode"], string> = { "01": "Microempresa", "03": "Empresa de pequeno porte", "05": "Demais" };

const longestMatch = (cnae: string, niches: Niche[]) => {
  let best: { niche: Niche; len: number } | null = null;
  for (const n of niches) {
    for (const p of n.cnaePrefixes) {
      if (cnae.startsWith(p) && (!best || p.length > best.len)) best = { niche: n, len: p.length };
    }
  }
  return best?.niche ?? null;
};

/** Nicho da empresa: pelo CNAE principal (prefixo mais específico) ou, na falta, por um CNAE secundário. */
export function matchNiche(company: Pick<Company, "cnaeMain" | "cnaeSecondary">, niches: Niche[]): { niche: Niche | null; via: "principal" | "secundario" | null } {
  const main = longestMatch(company.cnaeMain, niches);
  if (main) return { niche: main, via: "principal" };
  for (const c of company.cnaeSecondary) {
    const sec = longestMatch(c, niches);
    if (sec) return { niche: sec, via: "secundario" };
  }
  return { niche: null, via: null };
}

/** Meses completos entre duas datas AAAA-MM-DD. */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export function bandFor(score: number): ScoreBand {
  if (score >= 80) return "prioritario";
  if (score >= 65) return "alto";
  if (score >= 45) return "intermediario";
  return "baixo";
}

/**
 * Nota da empresa. `releasedServices`: códigos liberados no catálogo (apto comercialmente) — os demais nunca são sugeridos.
 * `today`: AAAA-MM-DD (fuso de São Paulo), passado de fora para o cálculo ser reprodutível.
 */
export function scoreCompany(company: Company, niches: Niche[], releasedServices: ReadonlySet<string>, today: string): Score {
  const items: ScoreItem[] = [];
  const { niche, via } = matchNiche(company, niches);

  // 1. Aderência do CNAE ao portfólio (30)
  let fit = 0;
  let fitText = "CNAE fora dos nichos cadastrados";
  if (niche && via === "principal") {
    fit = niche.isEntry ? 30 : 22;
    fitText = `CNAE principal no nicho "${niche.name}"${niche.isEntry ? " (nicho de entrada)" : ""}`;
  } else if (niche) {
    fit = 15;
    fitText = `CNAE secundário no nicho "${niche.name}"`;
  }
  items.push({ key: "aderencia", label: "Aderência ao portfólio", points: fit, max: 30, text: fitText });

  // 2. Porte (20) — público prioritário do AUDDOC005: pequenas e médias empresas
  const sizePts = { "03": 20, "01": 16, "05": 12 }[company.sizeCode];
  items.push({ key: "porte", label: "Porte", points: sizePts, max: 20, text: `${SIZE_LABEL[company.sizeCode]} (Receita)` });

  // 3. Canal de contato (15) — dado cadastral; pode ser do contador, por isso é confirmado antes da abordagem
  const contactPts = (company.hasPhone ? 10 : 0) + (company.hasEmail ? 5 : 0);
  const contactText = company.hasPhone && company.hasEmail ? "Telefone e e-mail cadastrados" : company.hasPhone ? "Telefone cadastrado" : company.hasEmail ? "E-mail cadastrado" : "Sem telefone ou e-mail no cadastro";
  items.push({ key: "contato", label: "Canal de contato", points: contactPts, max: 15, text: contactText });

  // 4. Proximidade da sede (15)
  const km = company.kmFromBase;
  const nearPts = km === null ? 0 : km <= 50 ? 15 : km <= 100 ? 10 : km <= 150 ? 5 : 2;
  const nearText = km === null ? "Distância não disponível" : km <= 50 ? `A ${fmtKm(km)} de Sorocaba — atendimento presencial` : km <= 150 ? `A ${fmtKm(km)} de Sorocaba` : `A ${fmtKm(km)} de Sorocaba — atendimento on-line`;
  items.push({ key: "proximidade", label: "Proximidade", points: nearPts, max: 15, text: nearText });

  // 5. Tempo de atividade (10) — empresa nova costuma estar estruturando a SST
  let agePts = 0;
  let ageText = "Data de início não disponível";
  if (company.startedOn) {
    const months = Math.max(0, monthsBetween(company.startedOn, today));
    agePts = months <= 60 ? 10 : 6;
    ageText = months < 12 ? `Aberta há ${months} ${months === 1 ? "mês" : "meses"}` : `Aberta há ${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? "ano" : "anos"}`;
  }
  items.push({ key: "atividade", label: "Tempo de atividade", points: agePts, max: 10, text: ageText });

  // 6. Situação (10) — só empresas ativas chegam aqui; "não contatar" e clientes são excluídos antes
  items.push({ key: "situacao", label: "Situação", points: 10, max: 10, text: "Ativa, não é cliente e não está em \"não contatar\"" });

  const score = items.reduce((s, i) => s + i.points, 0);
  const suggestedServices = (niche?.serviceCodes ?? []).filter((c) => releasedServices.has(c));
  return { score, band: bandFor(score), items, niche, suggestedServices, version: SCORE_VERSION };
}

const fmtKm = (km: number) => `${km.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`;
