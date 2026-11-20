/**
 * Meta diária de contatos e sequência de dias (AUDDOC020 Rev.01, RP-23; meta de 20 por dia útil, decisão do Diretor de
 * 19/11/2026). Cálculo puro: recebe quantos contatos houve em cada dia (AAAA-MM-DD, fuso de São Paulo).
 */
const isBusinessDay = (day: string) => {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return w !== 0 && w !== 6;
};
const prevDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Sequência: dias úteis seguidos, terminando ontem, com a meta cumprida — mais hoje, se hoje já bateu a meta.
 * Fins de semana não quebram nem contam na sequência.
 */
export function goalStreak(perDay: Record<string, number>, today: string, goal: number): number {
  let streak = (perDay[today] ?? 0) >= goal ? 1 : 0;
  let d = prevDay(today);
  for (let i = 0; i < 400; i++) {
    if (isBusinessDay(d)) {
      if ((perDay[d] ?? 0) >= goal) streak += 1;
      else break;
    }
    d = prevDay(d);
  }
  return streak;
}

/** Dias úteis da semana (segunda a sexta) que já bateram a meta. */
export function weekGoalDays(perDay: Record<string, number>, today: string, goal: number): number {
  let d = today;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const w = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (isBusinessDay(d) && (perDay[d] ?? 0) >= goal) n += 1;
    if (w === 1) break;
    d = prevDay(d);
  }
  return n;
}
