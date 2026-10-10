/** Períodos do painel (datas no fuso de São Paulo, formato AAAA-MM-DD). */

export const PRESETS = {
  mes: "Este mês",
  mes_anterior: "Mês anterior",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  personalizado: "Personalizado",
} as const;
export type PresetKey = keyof typeof PRESETS;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d));

export type Period = { key: PresetKey; from: string; to: string; label: string };

export function resolvePeriod(sp: { periodo?: string; de?: string; ate?: string }, today: string): Period {
  const [y, m, d] = today.split("-").map(Number);
  const key = (Object.keys(PRESETS).includes(sp.periodo ?? "") ? sp.periodo : "mes") as PresetKey;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  let from: string;
  let to: string;
  switch (key) {
    case "mes_anterior":
      from = iso(utc(y, m - 2, 1));
      to = iso(utc(y, m - 1, 0));
      break;
    case "30d":
      from = iso(utc(y, m - 1, d - 29));
      to = today;
      break;
    case "90d":
      from = iso(utc(y, m - 1, d - 89));
      to = today;
      break;
    case "ano":
      from = `${y}-01-01`;
      to = `${y}-12-31`;
      break;
    case "personalizado": {
      const a = valid(sp.de) ?? iso(utc(y, m - 1, 1));
      const b = valid(sp.ate) ?? today;
      [from, to] = a <= b ? [a, b] : [b, a];
      break;
    }
    default:
      from = iso(utc(y, m - 1, 1));
      to = iso(utc(y, m, 0));
  }
  const br = (s: string) => s.split("-").reverse().join("/");
  return { key, from, to, label: `${br(from)} a ${br(to)}` };
}
