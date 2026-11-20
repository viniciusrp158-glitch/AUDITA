/** Meta diária e sequência de dias da prospecção (AUDDOC020 Rev.01, RP-23). */
import { describe, expect, it } from "vitest";
import { goalStreak, weekGoalDays } from "@/lib/prospect/goal-calc";

// 2026-11-19 é quinta-feira; 14 e 15/11 são sábado e domingo
describe("Meta diária de contatos", () => {
  it("sequência de dias úteis com a meta, sem contar fim de semana", () => {
    const perDay = { "2026-11-12": 20, "2026-11-13": 25, "2026-11-16": 20, "2026-11-17": 21, "2026-11-18": 30 };
    expect(goalStreak(perDay, "2026-11-19", 20)).toBe(5); // hoje ainda não bateu: conta até ontem
    expect(goalStreak({ ...perDay, "2026-11-19": 20 }, "2026-11-19", 20)).toBe(6);
    expect(goalStreak({ ...perDay, "2026-11-17": 19 }, "2026-11-19", 20)).toBe(1); // terça quebrou
    expect(goalStreak({}, "2026-11-19", 20)).toBe(0);
  });
  it("dias da semana com a meta cumprida", () => {
    expect(weekGoalDays({ "2026-11-16": 20, "2026-11-17": 5, "2026-11-18": 22, "2026-11-13": 40 }, "2026-11-19", 20)).toBe(2);
  });
});
