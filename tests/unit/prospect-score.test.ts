/** Qualificação do AUDITA PROSPECT (AUDDOC020 RP-06): regras explicáveis, faixas, nicho e serviços só liberados. */
import { describe, expect, it } from "vitest";
import { bandFor, matchNiche, monthsBetween, scoreCompany, type Company, type Niche } from "@/lib/prospect/score";

const NICHES: Niche[] = [
  { id: "1", code: "construcao", name: "Construção civil", cnaePrefixes: ["41", "42", "43"], serviceCodes: ["SST-002", "DOC-001", "TRN-NR35", "ESP-006"], isEntry: true },
  { id: "2", code: "industria", name: "Indústria de pequeno porte", cnaePrefixes: ["10", "25"], serviceCodes: ["TRN-NR11-P"], isEntry: true },
  { id: "3", code: "oficinas", name: "Manutenção e reparação de veículos", cnaePrefixes: ["4520"], serviceCodes: ["TRN-NR06"], isEntry: false },
  { id: "4", code: "atacado", name: "Atacado", cnaePrefixes: ["45"], serviceCodes: [], isEntry: false },
];
const RELEASED = new Set(["SST-002", "DOC-001", "TRN-NR35", "TRN-NR11-P", "TRN-NR06"]);
const base: Company = { cnaeMain: "4120400", cnaeSecondary: [], sizeCode: "03", startedOn: "2022-03-10", kmFromBase: 6, hasPhone: true, hasEmail: true };

describe("matchNiche", () => {
  it("usa o prefixo mais específico do CNAE principal", () => {
    expect(matchNiche({ cnaeMain: "4520001", cnaeSecondary: [] }, NICHES)).toMatchObject({ niche: { code: "oficinas" }, via: "principal" });
    expect(matchNiche({ cnaeMain: "4530703", cnaeSecondary: [] }, NICHES)).toMatchObject({ niche: { code: "atacado" }, via: "principal" });
  });
  it("cai para o CNAE secundário e, sem nenhum, não inventa nicho", () => {
    expect(matchNiche({ cnaeMain: "4711302", cnaeSecondary: ["2512800"] }, NICHES)).toMatchObject({ niche: { code: "industria" }, via: "secundario" });
    expect(matchNiche({ cnaeMain: "4711302", cnaeSecondary: ["6201501"] }, NICHES)).toEqual({ niche: null, via: null });
  });
});

describe("scoreCompany", () => {
  it("construtora de pequeno porte perto de Sorocaba é prioritária, com a conta explicada", () => {
    const s = scoreCompany(base, NICHES, RELEASED, "2026-11-14");
    expect(s.score).toBe(30 + 20 + 15 + 15 + 10 + 10);
    expect(s.band).toBe("prioritario");
    expect(s.items.map((i) => i.key)).toEqual(["aderencia", "porte", "contato", "proximidade", "atividade", "situacao"]);
    expect(s.items.reduce((t, i) => t + i.max, 0)).toBe(100);
    expect(s.items.find((i) => i.key === "atividade")?.text).toBe("Aberta há 4 anos");
    expect(s.version).toBe("v1");
  });

  it("só sugere serviços liberados no catálogo", () => {
    const s = scoreCompany(base, NICHES, RELEASED, "2026-11-14");
    expect(s.suggestedServices).toEqual(["SST-002", "DOC-001", "TRN-NR35"]);
    expect(s.suggestedServices).not.toContain("ESP-006");
  });

  it("empresa fora dos nichos, longe, sem contato e antiga cai para baixo potencial", () => {
    const s = scoreCompany({ cnaeMain: "6201501", cnaeSecondary: [], sizeCode: "05", startedOn: "2001-01-01", kmFromBase: 400, hasPhone: false, hasEmail: false }, NICHES, RELEASED, "2026-11-14");
    expect(s.score).toBe(0 + 12 + 0 + 2 + 6 + 10);
    expect(s.band).toBe("baixo");
    expect(s.niche).toBeNull();
    expect(s.suggestedServices).toEqual([]);
    expect(s.items.find((i) => i.key === "proximidade")?.text).toMatch(/on-line$/);
  });

  it("dados ausentes não pontuam e são declarados como não disponíveis", () => {
    const s = scoreCompany({ ...base, startedOn: null, kmFromBase: null }, NICHES, RELEASED, "2026-11-14");
    expect(s.items.find((i) => i.key === "atividade")).toMatchObject({ points: 0, text: "Data de início não disponível" });
    expect(s.items.find((i) => i.key === "proximidade")).toMatchObject({ points: 0, text: "Distância não disponível" });
  });

  it("nicho que não é de entrada e CNAE secundário valem menos", () => {
    expect(scoreCompany({ ...base, cnaeMain: "4520001" }, NICHES, RELEASED, "2026-11-14").items[0].points).toBe(22);
    expect(scoreCompany({ ...base, cnaeMain: "4711302", cnaeSecondary: ["4120400"] }, NICHES, RELEASED, "2026-11-14").items[0].points).toBe(15);
  });

  it("empresa recém-aberta: meses contados até o dia", () => {
    expect(monthsBetween("2026-01-20", "2026-11-14")).toBe(9);
    expect(scoreCompany({ ...base, startedOn: "2026-01-20" }, NICHES, RELEASED, "2026-11-14").items.find((i) => i.key === "atividade")?.text).toBe("Aberta há 9 meses");
  });
});

describe("bandFor", () => {
  it("limites das faixas", () => {
    expect([80, 79, 65, 64, 45, 44].map(bandFor)).toEqual(["prioritario", "alto", "alto", "intermediario", "intermediario", "baixo"]);
  });
});
