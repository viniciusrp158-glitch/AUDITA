/** IOC por município (AUDDOC020 RP-14): mesma fórmula do protótipo aprovado, explicada por critério. */
import { describe, expect, it } from "vitest";
import { computeIoc, type RegionInput } from "@/lib/prospect/ioc";

const R: RegionInput[] = [
  { ibge: "1", name: "Sorocaba", km: 0, byNiche: { a: 3739, b: 1974, c: 3442 }, allTargets: 142758 },
  { ibge: "2", name: "Barueri", km: 58.2, byNiche: { a: 2709, b: 1042, c: 3636 }, allTargets: 86300 },
  { ibge: "3", name: "Iperó", km: 19.8, byNiche: { a: 57, b: 178, c: 62 }, allTargets: 4190 },
  { ibge: "4", name: "Sem nicho", km: 10, byNiche: {}, allTargets: 500 },
];

describe("computeIoc", () => {
  it("ordena pelo IOC, soma só os nichos escolhidos e deixa de fora quem não tem empresa deles", () => {
    const r = computeIoc(R, ["a", "b", "c"]);
    expect(r.map((x) => x.name)).toEqual(["Sorocaba", "Barueri", "Iperó"]);
    expect(r[0].selected).toBe(9155);
    expect(r[0].parts.quantidade).toBe(30);
    expect(r[0].parts.distancia).toBe(10);
    for (const x of r) {
      expect(x.ioc).toBeGreaterThanOrEqual(0);
      expect(x.ioc).toBeLessThanOrEqual(100);
    }
  });

  it("muda quando o nicho escolhido muda", () => {
    const soB = computeIoc(R, ["b"]);
    expect(soB.find((x) => x.name === "Sorocaba")!.selected).toBe(1974);
    // Só com "b", Iperó passa à frente: a concentração desse nicho lá é 3× maior
    expect(soB[0].name).toBe("Iperó");
    expect(soB.find((x) => x.name === "Iperó")!.share).toBeCloseTo(178 / 4190, 6);
  });

  it("distância a partir de 150 km não pontua e sem nicho não há região", () => {
    const longe = computeIoc([{ ibge: "9", name: "Longe", km: 400, byNiche: { a: 10 }, allTargets: 100 }], ["a"]);
    expect(longe[0].parts.distancia).toBe(0);
    expect(computeIoc(R, ["x"])).toEqual([]);
  });
});
