import "server-only";
/**
 * Envio do e-mail de apresentação pelo Brevo (AUDDOC020 Rev.01, RP-09; e-mail aprovado pelo Diretor em 19/11/2026).
 * - Respeita a cota do dia (aquecimento 30 → 100) e a pausa por devolução (> 3%), calculadas no banco.
 * - Lote só com a validação jurídica registrada (data na configuração).
 * - Cada envio tem um código de descadastro; quem se descadastra vai para "não contatar".
 * - Fora da produção NÃO envia: registra como "simulado" (regra 7: nada real a partir do ambiente de testes).
 * A chave do Brevo chega cifrada do banco e só é aberta aqui, no servidor (src/lib/secret-box.ts).
 */
import { randomBytes } from "node:crypto";
import { isProduction } from "@/lib/env";
import { open } from "@/lib/secret-box";
import { createClient } from "@/lib/supabase/server";
import { presentationEmail } from "./email-template";

const BREVO = "https://api.brevo.com/v3";
export const UNSUBSCRIBE_BASE = "https://audita.seg.br/empresa/descadastro";

export type Quota = { configured: boolean; batch_allowed: boolean; daily_limit: number; sent_today: number; bounce_rate: number; paused: boolean };

export async function getEmailQuota(): Promise<Quota | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prospect_email_quota");
  if (error) {
    console.error("prospect_email_quota", error.code, error.message);
    return null;
  }
  const r = (data as Quota[])[0];
  return r ? { ...r, bounce_rate: Number(r.bounce_rate) } : null;
}

/** Motivo pelo qual não dá para enviar agora (ou null se pode). */
export function blockReason(q: Quota | null, opts: { batch?: boolean; count?: number } = {}): string | null {
  if (!q) return "Não foi possível consultar a cota de envio.";
  if (!q.configured) return "O envio de e-mail ainda não foi configurado (Configurações → Integrações → E-mail da prospecção).";
  if (q.paused) return "Envio pausado: as devoluções passaram de 3% dos últimos envios. Revise os e-mails antes de continuar.";
  if (opts.batch && !q.batch_allowed) return "Envio em lote bloqueado até o registro da validação jurídica (Configurações → Integrações → E-mail da prospecção).";
  const left = q.daily_limit - q.sent_today;
  if (left <= 0) return `Limite de hoje atingido (${q.daily_limit} e-mails). Amanhã o limite aumenta.`;
  if (opts.count && opts.count > left) return null; // o lote envia só o que cabe
  return null;
}

/** Devoluções informadas pelo Brevo nos últimos dias → marca os envios (alimenta a pausa automática). */
export async function syncBounces(apiKey: string): Promise<number> {
  if (!isProduction) return 0;
  const ids = new Set<string>();
  for (const event of ["hardBounces", "softBounces", "blocked", "invalid"]) {
    try {
      const r = await fetch(`${BREVO}/smtp/statistics/events?limit=500&days=7&event=${event}`, { headers: { "api-key": apiKey, accept: "application/json" }, cache: "no-store" });
      if (!r.ok) continue;
      const j = (await r.json()) as { events?: { messageId?: string }[] };
      for (const e of j.events ?? []) if (e.messageId) ids.add(e.messageId);
    } catch {
      /* sem rede ou Brevo fora do ar: segue sem sincronizar */
    }
  }
  if (!ids.size) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("prospect_email_mark_bounced", { p_provider_ids: [...ids] });
  return Number(data ?? 0);
}

export async function getSender(): Promise<{ sender_name: string; sender_email: string; reply_to: string; apiKey: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("prospect_email_sender");
  const r = (data as { sender_name: string | null; sender_email: string; reply_to: string; api_key_cipher: string | null }[] | null)?.[0];
  if (!r?.sender_name || !r.api_key_cipher) return null;
  try {
    return { sender_name: r.sender_name, sender_email: r.sender_email, reply_to: r.reply_to, apiKey: open(r.api_key_cipher) };
  } catch {
    console.error("prospect_email_sender: não foi possível abrir a chave (AUDITA_SECRETS_KEY)");
    return null;
  }
}

/** Envia (ou simula, fora da produção) um e-mail de apresentação e registra o envio. */
export async function sendPresentation(v: {
  sender: NonNullable<Awaited<ReturnType<typeof getSender>>>;
  leadId: string;
  cnpj: string;
  email: string;
  company: string;
  nicheCode: string | null;
  userName: string;
  batch: boolean;
}): Promise<{ ok: true; status: "enviado" | "simulado" } | { ok: false; error: string }> {
  const token = randomBytes(24).toString("hex");
  const unsubscribeUrl = `${UNSUBSCRIBE_BASE}?t=${token}`;
  const mail = presentationEmail({ userName: v.userName, company: v.company, nicheCode: v.nicheCode, unsubscribeUrl });
  let status: "enviado" | "simulado" | "falhou" = "simulado";
  let providerId: string | null = null;
  let error: string | null = null;
  if (isProduction) {
    try {
      const r = await fetch(`${BREVO}/smtp/email`, {
        method: "POST",
        headers: { "api-key": v.sender.apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: v.sender.sender_name, email: v.sender.sender_email },
          to: [{ email: v.email }],
          replyTo: { email: v.sender.reply_to },
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
          tags: ["prospeccao"],
        }),
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { messageId?: string; message?: string };
      if (r.ok && j.messageId) {
        status = "enviado";
        providerId = j.messageId;
      } else {
        status = "falhou";
        error = (j.message ?? `HTTP ${r.status}`).slice(0, 500);
      }
    } catch (e) {
      status = "falhou";
      error = String(e).slice(0, 500);
    }
  }
  const supabase = await createClient();
  const ins = await supabase.from("prospect_email_sends").insert({
    lead_id: v.leadId,
    cnpj: v.cnpj,
    email: v.email,
    subject: mail.subject,
    status,
    provider_id: providerId,
    error,
    token,
    batch: v.batch,
    is_test: !isProduction,
  });
  if (ins.error) console.error("prospect_email_sends", ins.error.code, ins.error.message);
  if (status === "falhou") return { ok: false, error: "O Brevo recusou o envio. Confira a configuração do e-mail." };
  return { ok: true, status };
}
