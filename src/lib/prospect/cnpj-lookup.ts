"use server";

/**
 * Cadastro de cliente pelo CNPJ (Frente A, A8): lê a base pública de CNPJ já carregada para o PROSPECT (estabelecimentos
 * ativos de SP, sem MEI/empresário individual) e devolve os dados para preencher o formulário. Não grava nada: quem
 * cadastra confere e salva. Fora desse recorte, avisa e o preenchimento continua manual.
 */
import { getAppUser } from "@/lib/auth";
import { formatPhone } from "@/lib/br";
import { createClient } from "@/lib/supabase/server";

export type CnpjLookup =
  | {
      ok: true;
      publication: string;
      values: Record<
        "legal_name" | "trade_name" | "cnae" | "phone" | "email" | "address_zip" | "address_street" | "address_number" | "address_complement" | "address_district" | "address_city" | "address_state",
        string
      >;
    }
  | { ok: false; message: string };

export async function lookupCnpj(raw: string): Promise<CnpjLookup> {
  const cnpj = String(raw ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) return { ok: false, message: "Digite o CNPJ completo (14 caracteres) para buscar." };
  const user = await getAppUser();
  if (!user || (user.role !== "admin" && user.role !== "operador")) return { ok: false, message: "Sem permissão para consultar a base." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cnpj_establishments")
    .select("legal_name, trade_name, cnae_main, street, number, complement, district, zip, phone1, email, publication, ibge_municipalities(name, uf)")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (error) return { ok: false, message: "Não foi possível consultar a base agora. Preencha manualmente ou tente de novo." };
  if (!data)
    return {
      ok: false,
      message:
        "CNPJ não encontrado na base pública carregada (empresas ativas de SP, sem MEI). Confira o número ou preencha manualmente.",
    };
  const mun = data.ibge_municipalities as unknown as { name: string; uf: string } | null;
  return {
    ok: true,
    publication: data.publication,
    values: {
      legal_name: data.legal_name,
      trade_name: data.trade_name ?? "",
      cnae: data.cnae_main.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3"),
      phone: formatPhone(data.phone1),
      email: (data.email ?? "").toLowerCase(),
      address_zip: (data.zip ?? "").replace(/^(\d{5})(\d{3})$/, "$1-$2"),
      address_street: data.street ?? "",
      address_number: data.number ?? "",
      address_complement: data.complement ?? "",
      address_district: data.district ?? "",
      address_city: mun?.name ?? "",
      address_state: mun?.uf ?? "SP",
    },
  };
}
