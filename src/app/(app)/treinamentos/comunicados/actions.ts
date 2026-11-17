"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { TrState } from "../actions";
import { DESTINOS } from "./destinos";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comunicado da gestão para os alunos da Audita Academy (todos ou os de um curso). Aparece em Notificações. */
export async function sendNoticeAction(_prev: TrState, formData: FormData): Promise<TrState> {
  await requireAppUser(ADMIN_ONLY);
  const values = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
  const title = (values.title ?? "").trim();
  const body = (values.body ?? "").trim();
  const link = values.link ?? "";
  const course = values.course_id ?? "";
  const fe: Record<string, string> = {};
  if (title.length < 3 || title.length > 140) fe.title = "Título de 3 a 140 caracteres.";
  if (body.length > 2000) fe.body = "Até 2.000 caracteres.";
  if (link && !DESTINOS.some((d) => d.value === link)) fe.link = "Destino inválido.";
  if (course && !uuidRe.test(course)) fe.course_id = "Curso inválido.";
  if (Object.keys(fe).length) return { values, fieldErrors: fe, error: "Revise os campos destacados." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_send_notice", {
    p_title: title,
    p_body: body || null,
    p_link: link || null,
    p_course_id: course || null,
  });
  if (error) return { values, error: "Não foi possível enviar o comunicado. Tente de novo." };
  revalidatePath("/treinamentos/comunicados");
  return { ok: "Comunicado enviado. Os alunos veem em Notificações.", seq: Date.now() };
}
