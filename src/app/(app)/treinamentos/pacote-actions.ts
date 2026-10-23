"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import type { FichaData } from "@/lib/training/pacote";
import { pdfToText } from "@/lib/training/pdf-text";
import { createClient } from "@/lib/supabase/server";

const MAX_ANALYSIS_BYTES = 8 * 1024 * 1024;

/** Texto de um PDF do pacote para a conferência (normal e com o -layout, usado na tabela de minutos da ficha). */
export async function pdfTextAction(formData: FormData): Promise<{ error?: string; text?: string; layout?: string }> {
  await requireAppUser(ADMIN_ONLY);
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Arquivo não recebido." };
  if (file.size > MAX_ANALYSIS_BYTES) return { error: "PDF grande demais para a conferência." };
  const data = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...data.slice(0, 5)) !== "%PDF-") return { error: "O arquivo não é um PDF." };
  try {
    const text = await pdfToText(data);
    const layout = formData.get("layout") === "1" ? await pdfToText(data, { layout: true }) : "";
    return { text, layout };
  } catch {
    return { error: "Não foi possível ler o texto do PDF." };
  }
}

export type PackageModuleInput = Pick<FichaData["modules"][number], "position" | "title" | "objective" | "content_summary" | "video_minutes" | "reading_minutes" | "activity_minutes">;
export type PackageCreateInput = {
  code: string;
  title: string;
  version: string;
  ficha: Partial<Omit<FichaData, "modules" | "title" | "version">>;
  modules: PackageModuleInput[];
};

function dbMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error && ["23514", "42501", "22023", "23505"].includes(error.code ?? "") && error.message && !/violates|permission denied/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

/** Cria o treinamento (ou a nova versão), a ficha técnica e os módulos lidos do pacote. */
export async function createFromPackageAction(
  input: PackageCreateInput,
): Promise<{ error?: string; courseId?: string; versionId?: string; createdCourse?: boolean; modules?: Record<string, string> }> {
  await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_import_package", {
    p_code: input.code,
    p_title: input.title,
    p_version: input.version,
    p_ficha: input.ficha,
    p_modules: input.modules,
  });
  if (error || !data) return { error: dbMessage(error, "Não foi possível criar o treinamento a partir do pacote.") };
  const r = data as { course_id: string; version_id: string; created_course: boolean; modules: Record<string, string> };
  revalidatePath("/treinamentos");
  return { courseId: r.course_id, versionId: r.version_id, createdCourse: r.created_course, modules: r.modules };
}
