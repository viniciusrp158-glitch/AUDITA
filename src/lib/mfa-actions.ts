"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/** Verificação em duas etapas (TOTP — aplicativo autenticador). Caderno I3.01; AUDDOC017 §10. */
export type MfaState = { ok?: string; error?: string; factorId?: string; qr?: string; secret?: string; seq?: number };

const codeRe = /^\d{6}$/;

export async function startEnrollAction(_prev: MfaState): Promise<MfaState> {
  const user = await getAppUser();
  if (!user) return { error: "Sessão inválida." };
  const supabase = await createClient();
  // Remove tentativas anteriores não confirmadas (o Supabase não aceita duas pendentes com o mesmo nome)
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `AUDITA ${Date.now()}` });
  if (error || !data) return { error: "Não foi possível iniciar a ativação. Tente novamente." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, seq: Date.now() };
}

export async function confirmEnrollAction(prev: MfaState, formData: FormData): Promise<MfaState> {
  const code = String(formData.get("codigo") ?? "").replace(/\D/g, "");
  if (!prev.factorId) return { error: "Inicie a ativação novamente." };
  if (!codeRe.test(code)) return { ...prev, error: "Digite os 6 números do aplicativo." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: prev.factorId, code });
  if (error) return { ...prev, error: "Código inválido ou expirado. Confira o horário do celular e tente de novo." };
  revalidatePath("/conta");
  return { ok: "Verificação em duas etapas ativada. Nos próximos acessos, o código será pedido após a senha.", seq: Date.now() };
}

export async function disableMfaAction(_prev: MfaState, formData: FormData): Promise<MfaState> {
  if (formData.get("confirm") !== "on") return { error: "Confirme a desativação." };
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { error: "Entre com o código do aplicativo antes de desativar." };
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.totp ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { error: "Não foi possível desativar. Tente novamente." };
  }
  revalidatePath("/conta");
  return { ok: "Verificação em duas etapas desativada.", seq: Date.now() };
}

/** Segunda etapa do login: código do aplicativo autenticador. */
export async function verifyLoginAction(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const code = String(formData.get("codigo") ?? "").replace(/\D/g, "");
  if (!codeRe.test(code)) return { error: "Digite os 6 números do aplicativo." };
  const supabase = await createClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  const factor = list?.totp?.[0];
  if (!factor) redirect("/");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "Código inválido ou expirado. Tente novamente." };
  await supabase.rpc("log_access_event", { event: "login" });
  const { data: role } = await supabase.rpc("current_app_role");
  if (!role) {
    await supabase.rpc("log_access_event", { event: "access_denied" });
    await supabase.auth.signOut();
    redirect("/sem-acesso");
  }
  const me = await getAppUser();
  if (me?.mustChangePassword) redirect("/atualizar-senha?primeiro=1");
  redirect(homeFor(role));
}
