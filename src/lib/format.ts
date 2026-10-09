const TZ = "America/Sao_Paulo";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

/** dd/mm/aaaa hh:mm no fuso de São Paulo. */
export function formatDateTime(iso: string | Date): string {
  return dateTimeFmt.format(typeof iso === "string" ? new Date(iso) : iso).replace(",", "");
}

/** dd/mm/aaaa no fuso de São Paulo. */
export function formatDate(iso: string | Date): string {
  return dateFmt.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Data sem hora ("AAAA-MM-DD", coluna date do banco) → dd/mm/aaaa, sem conversão de fuso. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : day;
}

/** Hoje no fuso de São Paulo, como "AAAA-MM-DD". */
export function todaySaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
