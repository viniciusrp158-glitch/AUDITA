import "server-only";
/** Meta diária de contatos de quem está usando o sistema (AUDDOC020 Rev.01, RP-23). */
import { todaySaoPaulo } from "@/lib/format";
import { DAILY_GOAL } from "@/lib/prospect/labels";
import { createClient } from "@/lib/supabase/server";
import { goalStreak, weekGoalDays } from "./goal-calc";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

export async function getGoalProgress(userId: string): Promise<{ today: number; goal: number; streak: number; weekDays: number }> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("lead_activities")
    .select("occurred_at")
    .eq("created_by", userId)
    .in("kind", ["whatsapp", "ligacao", "email"])
    .gte("occurred_at", since)
    .limit(5000);
  const perDay: Record<string, number> = {};
  for (const r of (data ?? []) as { occurred_at: string }[]) {
    const d = dayFmt.format(new Date(r.occurred_at));
    perDay[d] = (perDay[d] ?? 0) + 1;
  }
  const today = todaySaoPaulo();
  return { today: perDay[today] ?? 0, goal: DAILY_GOAL, streak: goalStreak(perDay, today, DAILY_GOAL), weekDays: weekGoalDays(perDay, today, DAILY_GOAL) };
}
