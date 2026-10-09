"use server";

import { parseRegistration } from "@/lib/clients/registration";
import { formToObject } from "@/lib/clients/schema";
import { createClient } from "@/lib/supabase/server";

export type PublicFormState = {
  done?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * Envio público do autocadastro. Não usa sessão: chama apenas a função `submit_registration`,
 * que valida o link (uso único, 24 h), o aceite do termo vigente e a estrutura dos dados.
 */
export async function submitRegistrationAction(token: string, _prev: PublicFormState, formData: FormData): Promise<PublicFormState> {
  if (!TOKEN_RE.test(token)) return { error: "Link inválido." };
  const values = formToObject(formData);

  // Campo-armadilha para robôs (invisível para pessoas)
  if ((values.website ?? "").trim() !== "") return { done: true };

  if (values.accept_terms !== "on") {
    return { values, error: "Para enviar, confirme a leitura e o aceite do termo.", fieldErrors: { accept_terms: "Obrigatório." } };
  }

  const parsed = parseRegistration(values);
  if (!parsed.ok) return { values, error: parsed.message, fieldErrors: parsed.errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_registration", {
    p_token: token,
    p_payload: parsed.payload,
    p_terms_version: values.terms_version ?? "",
    p_accept: true,
  });

  if (error) {
    const known = ["Este link já foi utilizado", "Este link expirou", "Este link foi cancelado", "Link inválido", "CNPJ/CPF inválido", "É necessário aceitar a versão vigente do termo", "Cada contato precisa de nome e e-mail ou telefone"];
    const msg = known.find((k) => error.message?.includes(k));
    return { values, error: msg ? `${msg}.` : "Não foi possível enviar. Verifique os dados e tente novamente." };
  }
  return { done: true };
}
