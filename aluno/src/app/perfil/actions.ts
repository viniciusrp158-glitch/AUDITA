"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PerfilState = { ok?: string; error?: string };

const txt = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v ? v : null;
};

/** Meu Perfil: grava pela função do próprio aluno (o banco valida CPF, CEP, UF e telefone). */
export async function salvarPerfil(_prev: PerfilState, f: FormData): Promise<PerfilState> {
  const nascimento = txt(f, "nascimento");
  if (nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return { error: "Data de nascimento inválida." };
  const telefone = (txt(f, "telefone") ?? "").replace(/\D/g, "");
  if (telefone && (telefone.length < 10 || telefone.length > 13)) return { error: "Informe o celular com DDD." };
  const cep = (txt(f, "cep") ?? "").replace(/\D/g, "");
  if (cep && cep.length !== 8) return { error: "O CEP tem 8 números." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_update_my_profile", {
    p_full_name: txt(f, "nome") ?? "",
    p_cpf: txt(f, "cpf"),
    p_birth_date: nascimento,
    p_phone: telefone || null,
    p_company: txt(f, "empresa"),
    p_job_title: txt(f, "cargo"),
    p_cep: cep || null,
    p_street: txt(f, "rua"),
    p_number: txt(f, "numero"),
    p_complement: txt(f, "complemento"),
    p_district: txt(f, "bairro"),
    p_city: txt(f, "cidade"),
    p_state: txt(f, "uf"),
    p_email_notices: f.get("avisos_email") === "on",
  });
  if (error) {
    const m = error.message ?? "";
    if (/CPF inválido|nome completo|nascimento/i.test(m)) return { error: m.replace(/\.$/, "") + "." };
    if (error.code === "23514") return { error: "Confira os campos: algum valor está fora do formato esperado." };
    return { error: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath("/perfil");
  return { ok: "Perfil salvo." };
}
