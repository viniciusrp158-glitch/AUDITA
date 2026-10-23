"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formToObject } from "@/lib/clients/schema";
import { isValidCnpj, onlyDigits } from "@/lib/br";
import { createClient } from "@/lib/supabase/server";
import type { TrState } from "../actions";

function dbMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error && ["23514", "42501", "22023"].includes(error.code ?? "") && error.message && !/violates|permission denied/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

const refresh = () => {
  revalidatePath("/treinamentos/vendas");
  revalidatePath("/treinamentos");
};

/** Vendedor, suporte, CPF obrigatório, termos e política de privacidade. */
export async function saveSalesSettingsAction(_prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  const values = formToObject(formData);
  const fe: Record<string, string> = {};
  const seller = (values.seller_name ?? "").trim();
  const cnpj = onlyDigits(values.seller_document);
  const email = (values.support_email ?? "").trim().toLowerCase();
  const phone = onlyDigits(values.support_phone);
  const terms = (values.terms_text ?? "").trim();
  const privacy = (values.privacy_text ?? "").trim();
  if (seller && (seller.length < 3 || seller.length > 200)) fe.seller_name = "Informe a razão social (3 a 200 caracteres).";
  if (cnpj && !isValidCnpj(cnpj)) fe.seller_document = "CNPJ inválido.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fe.support_email = "E-mail inválido.";
  if (phone && !/^\d{10,13}$/.test(phone)) fe.support_phone = "Telefone com DDD (10 a 13 dígitos).";
  if (terms && terms.length < 50) fe.terms_text = "Texto curto demais para termos de uso e de compra.";
  if (privacy && privacy.length < 50) fe.privacy_text = "Texto curto demais para a política de privacidade.";
  if (Object.keys(fe).length) return { values, fieldErrors: fe, error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_sales_settings")
    .update({
      seller_name: seller || null,
      seller_document: cnpj || null,
      support_email: email || null,
      support_phone: phone || null,
      require_cpf: values.require_cpf === "on",
      terms_text: terms || null,
      privacy_text: privacy || null,
    })
    .eq("id", 1);
  if (error) return { values, error: dbMessage(error, "Não foi possível salvar as configurações de venda.") };
  refresh();
  return { ok: "Configurações de venda salvas.", seq: Date.now() };
}

/** Credencial do Mercado Pago (gravada no Vault; o campo nunca volta preenchido). */
export async function savePaymentSecretAction(kind: "mp_access_token" | "mp_webhook_secret", _prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  const value = String(formData.get("value") ?? "").trim();
  if (!value) return { fieldErrors: { value: "Cole a credencial." }, error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_set_payment_secret", { p_kind: kind, p_value: value });
  if (error) return { fieldErrors: { value: dbMessage(error, "Não foi possível guardar a credencial.") } };
  refresh();
  return { ok: kind === "mp_access_token" ? "Access Token guardado." : "Assinatura secreta guardada.", seq: Date.now() };
}

/** Abre ou fecha a vitrine e as vendas. */
export async function setSalesOpenAction(open: boolean): Promise<{ error?: string; ok?: string }> {
  await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const { error } = await supabase.from("training_sales_settings").update({ sales_enabled: open }).eq("id", 1);
  if (error) return { error: dbMessage(error, "Não foi possível mudar a situação das vendas.") };
  refresh();
  return { ok: open ? "Vendas abertas." : "Vendas fechadas." };
}
