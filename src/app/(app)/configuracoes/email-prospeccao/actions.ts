"use server";

/**
 * Configuração do e-mail da prospecção (AUDDOC020 Rev.01; decisões do Diretor de 19/11/2026). Só o administrador.
 * A chave do Brevo é cifrada aqui, no servidor, antes de ir para o banco; nunca é devolvida ao navegador.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { seal, secretsConfigured } from "@/lib/secret-box";
import { createClient } from "@/lib/supabase/server";

export type EmailConfigState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

const schema = z
  .object({
    sender_name: z.string().trim().min(3, "Informe o nome do remetente.").max(80),
    sender_email: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]+@audita\.seg\.br$/, "Use um endereço @audita.seg.br."),
    reply_to: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
    daily_start: z.coerce.number().int().min(1).max(100),
    daily_max: z.coerce.number().int().min(1, "Mínimo 1.").max(100, "Máximo 100 por dia (decisão do Diretor)."),
    legal_validated_on: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/)
      .optional(),
    api_key: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.daily_max >= v.daily_start, { message: "O máximo precisa ser maior ou igual ao início.", path: ["daily_max"] });

export async function saveEmailConfigAction(_prev: EmailConfigState, formData: FormData): Promise<EmailConfigState> {
  await requireAppUser(ADMIN_ONLY);
  const p = schema.safeParse(Object.fromEntries(["sender_name", "sender_email", "reply_to", "daily_start", "daily_max", "legal_validated_on", "api_key"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0] ?? "form")] = i.message;
    return { fieldErrors: fe, error: "Revise os campos destacados." };
  }
  const update: Record<string, unknown> = {
    sender_name: p.data.sender_name,
    sender_email: p.data.sender_email,
    reply_to: p.data.reply_to,
    daily_start: p.data.daily_start,
    daily_max: p.data.daily_max,
    legal_validated_on: p.data.legal_validated_on || null,
  };
  if (p.data.api_key) {
    if (!secretsConfigured()) return { error: "O servidor ainda não tem a chave de criptografia (AUDITA_SECRETS_KEY). Avise o responsável técnico." };
    if (p.data.api_key.length < 20) return { fieldErrors: { api_key: "Chave curta demais." }, error: "Revise a chave." };
    update.api_key_cipher = seal(p.data.api_key);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("prospect_email_config").update(update).eq("id", 1);
  if (error) return { error: "Não foi possível salvar a configuração." };
  revalidatePath("/configuracoes/email-prospeccao");
  revalidatePath("/prospeccao", "layout");
  return { ok: p.data.api_key ? "Configuração salva. A chave foi guardada cifrada." : "Configuração salva." };
}
