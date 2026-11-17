"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type NicheState = { ok?: string; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3, "Mínimo de 3 caracteres.").max(120),
  prefixes: z
    .string()
    .transform((v) => [...new Set(v.split(/[\s,;]+/).map((p) => p.replace(/\D/g, "")).filter(Boolean))])
    .refine((a) => a.length >= 1 && a.length <= 60, "Informe de 1 a 60 códigos.")
    .refine((a) => a.every((p) => p.length >= 2 && p.length <= 7), "Cada código de CNAE deve ter de 2 a 7 dígitos (ex.: 41, 4930, 4120400)."),
  services: z.array(z.string().regex(/^[A-Z0-9-]{3,20}$/)).max(30),
  is_entry: z.boolean(),
  status: z.enum(["ativo", "inativo"]),
  notes: z.string().trim().max(1000),
});

/** Nicho ↔ CNAE ↔ serviços (AUDDOC020 RP-03). Inativação lógica; o resumo das regiões é recalculado. */
export async function saveNicheAction(_prev: NicheState, formData: FormData): Promise<NicheState> {
  await requireAppUser(OPERATE);
  const p = schema.safeParse({
    id: formData.get("id") || undefined,
    name: String(formData.get("name") ?? ""),
    prefixes: String(formData.get("prefixes") ?? ""),
    services: formData.getAll("services").map(String),
    is_entry: formData.get("is_entry") === "on",
    status: formData.get("status") === "inativo" ? "inativo" : "ativo",
    notes: String(formData.get("notes") ?? ""),
  });
  if (!p.success) {
    const fe: Record<string, string> = {};
    for (const i of p.error.issues) fe[String(i.path[0] ?? "form")] = i.message;
    return { fieldErrors: fe, error: "Revise os campos destacados." };
  }
  const supabase = await createClient();
  const row = {
    name: p.data.name,
    cnae_prefixes: p.data.prefixes,
    service_codes: p.data.services,
    is_entry: p.data.is_entry,
    status: p.data.status,
    notes: p.data.notes || null,
  };
  let error;
  if (p.data.id) {
    ({ error } = await supabase.from("prospect_niches").update(row).eq("id", p.data.id));
  } else {
    const code = p.data.name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    ({ error } = await supabase.from("prospect_niches").insert({ ...row, code: code.length >= 2 ? code : `nicho_${Date.now()}`, sort_order: 200 }));
  }
  if (error) return { error: error.code === "23505" ? "Já existe um nicho com esse nome." : "Não foi possível salvar o nicho." };
  // Recalcula o resumo de empresas por município e nicho (alguns segundos)
  await supabase.rpc("refresh_prospect_region_stats");
  revalidatePath("/prospeccao", "layout");
  return { ok: "Nicho salvo. As contagens por região foram recalculadas." };
}
