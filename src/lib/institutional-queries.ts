import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionalProfile } from "./institutional";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listInstitutionalProfiles(): Promise<InstitutionalProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("institutional_profiles").select("*").order("version", { ascending: false });
  return (data ?? []) as InstitutionalProfile[];
}

export async function getInstitutionalOr404(id: string): Promise<InstitutionalProfile> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("institutional_profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as InstitutionalProfile;
}
