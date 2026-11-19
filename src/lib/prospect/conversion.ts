import "server-only";
/**
 * Conversão do lead em cliente (AUDDOC020 RP-12): rascunho do cadastro a partir do lead e da base pública da Receita,
 * e verificação por CNPJ (se a empresa já é cliente, o lead é vinculado ao cadastro existente, sem duplicar).
 */
import type { ClientFormValues } from "@/app/(app)/clientes/client-form";
import { createClient } from "@/lib/supabase/server";

export type LeadForConversion = { id: string; name: string; cnpj: string | null; client_id: string | null; stage: string };
export type ExistingClient = { id: string; client_code: string; legal_name: string; status: string };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cliente já cadastrado com o CNPJ do lead (verificação de duplicidade). */
export async function findClientByCnpj(cnpj: string | null): Promise<ExistingClient | null> {
  if (!cnpj) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, client_code, legal_name, status").eq("tax_id", cnpj).limit(1).maybeSingle();
  return (data as ExistingClient | null) ?? null;
}

export async function getClientDraftFromLead(leadId: string): Promise<{ lead: LeadForConversion; initial: ClientFormValues; existing: ExistingClient | null } | null> {
  if (!uuidRe.test(leadId)) return null;
  const supabase = await createClient();
  const { data: l } = await supabase
    .from("leads")
    .select("id, cnpj, legal_name, trade_name, cnae_main, stage, client_id, phone_confirmed, email_confirmed, contact_person")
    .eq("id", leadId)
    .maybeSingle();
  if (!l) return null;
  const { data: e } = l.cnpj
    ? await supabase
        .from("cnpj_establishments")
        .select("legal_name, trade_name, cnae_main, street, number, complement, district, zip, phone1, email, ibge_municipalities(name, uf)")
        .eq("cnpj", l.cnpj)
        .maybeSingle()
    : { data: null };
  const mun = (e?.ibge_municipalities as unknown as { name: string; uf: string } | null) ?? null;
  const initial: ClientFormValues = {
    person_type: "PJ",
    legal_name: e?.legal_name ?? l.legal_name,
    trade_name: e?.trade_name ?? l.trade_name,
    tax_id: l.cnpj,
    cnae: e?.cnae_main ?? l.cnae_main,
    // Contato confirmado pelo usuário tem preferência sobre o cadastro da Receita (que costuma ser do contador)
    phone: l.phone_confirmed ?? e?.phone1 ?? null,
    email: (l.email_confirmed ?? e?.email ?? "").toLowerCase() || null,
    address_zip: e?.zip ?? null,
    address_street: e?.street ?? null,
    address_number: e?.number ?? null,
    address_complement: e?.complement ?? null,
    address_district: e?.district ?? null,
    address_city: mun?.name ?? null,
    address_state: mun?.uf ?? "SP",
    notes: l.contact_person ? `Contato na prospecção: ${l.contact_person}` : null,
  };
  return {
    lead: { id: l.id, name: l.trade_name || l.legal_name, cnpj: l.cnpj, client_id: l.client_id, stage: l.stage },
    initial,
    existing: await findClientByCnpj(l.cnpj),
  };
}
