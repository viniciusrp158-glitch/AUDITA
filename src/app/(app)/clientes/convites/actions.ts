"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors } from "@/lib/clients/schema";
import { dbErrorMessage } from "@/lib/db-errors";
import { isProduction } from "@/lib/env";
import { generateInviteToken, hashInviteToken, publicOrigin } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export type InviteState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  created?: { link: string; recipient: string; expiresAt: string };
};

const schema = z.object({
  recipient: z.string().trim().min(2, "Informe para quem o link será enviado.").max(160),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Gera link individual (uso único, 24 h). O token aparece só nesta resposta; o banco guarda o hash. */
export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAppUser();
  const parsed = schema.safeParse({ recipient: formData.get("recipient"), note: formData.get("note") ?? undefined });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const token = generateInviteToken();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_invites")
    .insert({ token_hash: hashInviteToken(token), recipient: parsed.data.recipient, note: parsed.data.note, is_test: !isProduction })
    .select("expires_at")
    .single();
  if (error || !data) return { error: dbErrorMessage(error) };

  revalidatePath("/clientes/convites");
  return {
    created: { link: `${await publicOrigin()}/cadastro/${token}`, recipient: parsed.data.recipient, expiresAt: data.expires_at },
  };
}

export async function cancelInviteAction(id: string) {
  await requireAppUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  await supabase.from("client_invites").update({ cancelled_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  revalidatePath("/clientes/convites");
}
