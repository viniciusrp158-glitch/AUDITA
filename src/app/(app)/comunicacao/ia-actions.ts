"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { fieldErrors, formToObject } from "@/lib/clients/schema";
import { aiConfigured, generateArt, type ArtContext } from "@/lib/comunicacao/ai";
import { MAX_REFERENCE_BYTES, MAX_REFERENCES, normalizeReference, REFERENCE_TYPES, type NormalizedImage } from "@/lib/comunicacao/images";
import { BRAND_KEYS, CHANNELS, TEMPLATE_KEYS, type Brand, type Template } from "@/lib/comunicacao/labels";
import { isProduction } from "@/lib/env";
import { COMMUNICATE } from "@/lib/permissions";
import { SCOPE_COLUMNS, serviceScopeText } from "@/lib/services/scope";
import { createClient } from "@/lib/supabase/server";
import type { CommState } from "./actions";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || uuidRe.test(v), "Seleção inválida.");
const instruction = z.string().trim().min(10, "Descreva a arte com pelo menos 10 caracteres.").max(2000, "Máximo de 2.000 caracteres.");
const NOT_CONFIGURED = "A IA ainda não está ligada neste servidor (falta a chave da Anthropic). Veja as instruções na tela.";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Reference = NormalizedImage & { background: boolean };

/** Imagens anexadas (até 3): reduzidas no servidor; a primeira pode virar a foto de fundo da arte. */
async function readReferences(formData: FormData): Promise<{ refs: Reference[]; error?: string }> {
  const files = formData.getAll("references").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_REFERENCES) return { refs: [], error: `Envie no máximo ${MAX_REFERENCES} imagens.` };
  const background = formData.get("use_background") === "on";
  const refs: Reference[] = [];
  for (const [i, f] of files.entries()) {
    if (!REFERENCE_TYPES.includes(f.type)) return { refs: [], error: `"${f.name}": envie imagens PNG, JPEG ou WebP.` };
    if (f.size > MAX_REFERENCE_BYTES) return { refs: [], error: `"${f.name}" tem mais de 8 MB.` };
    try {
      refs.push({ ...(await normalizeReference(Buffer.from(await f.arrayBuffer()))), background: background && i === 0 });
    } catch {
      return { refs: [], error: `"${f.name}" não pôde ser lida como imagem.` };
    }
  }
  return { refs };
}

/**
 * Executa o pedido depois da resposta ao navegador (a arte leva de 1 a 3 minutos). A tela da peça acompanha a
 * situação do pedido e se atualiza sozinha. Qualquer falha fica registrada no pedido, com a mensagem em português.
 */
async function runArtRequest(supabase: Supabase, requestId: string): Promise<void> {
  const fail = async (error: string, model?: string, usage?: Record<string, unknown>) => {
    await supabase.from("comm_ai_requests").update({ status: "erro", error: error.slice(0, 500), model: model ?? null, usage: usage ?? null }).eq("id", requestId);
  };
  try {
    const { data: req } = await supabase.from("comm_ai_requests").select("id, piece_id, mode, instruction").eq("id", requestId).maybeSingle();
    if (!req) return;
    const { data: p } = await supabase
      .from("comm_pieces")
      .select("id, template, brand, channel, theme, objective, audience, service_id, campaign_id, title, subtitle, body, cta, art_id")
      .eq("id", req.piece_id)
      .maybeSingle();
    if (!p) return fail("Peça não encontrada.");

    let service: ArtContext["service"] = null;
    if (p.service_id) {
      // O escopo do catálogo vai junto quando a pessoa tem acesso a ele (administrador); senão, só código e nome
      const full = await supabase.from("services").select(`service_code, name, commercial_status, ${SCOPE_COLUMNS}`).eq("id", p.service_id).maybeSingle();
      if (full.data) service = { service_code: full.data.service_code, name: full.data.name, commercial_status: full.data.commercial_status, scope: serviceScopeText(full.data) };
      else {
        const { data: opts } = await supabase.rpc("comm_service_options");
        const o = ((opts ?? []) as { id: string; service_code: string; name: string; commercial_status: string }[]).find((x) => x.id === p.service_id);
        if (o) service = { service_code: o.service_code, name: o.name, commercial_status: o.commercial_status, scope: "" };
      }
    }
    const campaign = p.campaign_id ? (await supabase.from("comm_campaigns").select("name").eq("id", p.campaign_id).maybeSingle()).data?.name ?? null : null;
    const current = req.mode === "ajustar" && p.art_id ? (await supabase.from("comm_piece_arts").select("svg, background_ref_id").eq("id", p.art_id).maybeSingle()).data : null;
    const currentSvg = current?.svg ?? null;
    const { data: refRows } = await supabase
      .from("comm_ai_references")
      .select("id, mime_type, data_base64, use_as_background")
      .eq("request_id", requestId)
      .order("position");
    const refs = (refRows ?? []) as { id: string; mime_type: "image/png" | "image/jpeg"; data_base64: string; use_as_background: boolean }[];
    // Foto de fundo: a nova, se enviada; senão a da arte atual (no ajuste), que também vai para a IA ver
    let backgroundId = refs.find((r) => r.use_as_background)?.id ?? null;
    const images = refs.map((r) => ({ mime: r.mime_type, base64: r.data_base64, background: r.use_as_background }));
    if (!backgroundId && current?.background_ref_id) {
      const { data: bg } = await supabase.from("comm_ai_references").select("id, mime_type, data_base64").eq("id", current.background_ref_id).maybeSingle();
      if (bg) {
        backgroundId = bg.id;
        images.unshift({ mime: bg.mime_type as "image/png" | "image/jpeg", base64: bg.data_base64, background: true });
      }
    }

    const res = await generateArt({
      brand: p.brand as Brand,
      template: p.template as Template,
      channel: CHANNELS[p.channel as keyof typeof CHANNELS] ?? p.channel,
      theme: p.theme,
      objective: p.objective,
      audience: p.audience,
      service,
      campaign,
      instruction: req.instruction,
      references: images,
      hasBackground: Boolean(backgroundId),
      current: currentSvg ? { title: p.title, subtitle: p.subtitle, body: p.body, cta: p.cta, svg: currentSvg } : null,
    });
    if (!res.ok) return fail(res.error, res.model, res.usage);

    const { data: art, error: artError } = await supabase
      .from("comm_piece_arts")
      .insert({ piece_id: p.id, request_id: requestId, svg: res.result.svg, alt_text: res.result.alt_text, background_ref_id: backgroundId })
      .select("id")
      .single();
    if (artError || !art) return fail("A arte gerada não pôde ser gravada (conteúdo não permitido ou peça fora do rascunho).", res.model, res.usage);
    const { error: upError } = await supabase
      .from("comm_pieces")
      .update({
        art_id: art.id,
        title: res.result.title,
        subtitle: res.result.subtitle,
        body: res.result.body,
        cta: res.result.cta,
        caption: res.result.caption,
      })
      .eq("id", p.id)
      .eq("status", "rascunho");
    if (upError) return fail("A peça saiu do rascunho durante a geração; a arte ficou guardada, mas não foi aplicada.", res.model, res.usage);
    await supabase.from("comm_ai_requests").update({ status: "concluida", model: res.model, usage: res.usage }).eq("id", requestId);
  } catch (e) {
    console.error("[comunicacao-ia]", e);
    await fail("Falha inesperada ao gerar a arte. Tente de novo.");
  }
}

async function startRequest(supabase: Supabase, pieceId: string, mode: "criar" | "ajustar", text: string, refs: Reference[]): Promise<string | null> {
  const { data, error } = await supabase
    .from("comm_ai_requests")
    .insert({ piece_id: pieceId, mode, instruction: text, is_test: !isProduction })
    .select("id")
    .single();
  if (error || !data) return error?.code === "23505" ? "Já existe uma arte sendo gerada para esta peça; aguarde terminar." : error?.message?.includes("rascunho") ? "A arte só pode ser criada ou ajustada com a peça em rascunho." : null;
  const requestId = data.id;
  if (refs.length) {
    const { error: refError } = await supabase.from("comm_ai_references").insert(
      refs.map((r, i) => ({
        request_id: requestId,
        piece_id: pieceId,
        position: i + 1,
        mime_type: r.mime,
        data_base64: r.base64,
        width: r.width,
        height: r.height,
        use_as_background: r.background,
      })),
    );
    if (refError) {
      await supabase.from("comm_ai_requests").update({ status: "erro", error: "As imagens anexadas não puderam ser gravadas." }).eq("id", requestId);
      return "As imagens anexadas não puderam ser gravadas (tamanho ou formato). Tente com outras imagens.";
    }
  }
  after(() => runArtRequest(supabase, requestId));
  return "";
}

const newSchema = z.object({
  template: z.enum(TEMPLATE_KEYS as [string, ...string[]], { message: "Escolha o formato." }),
  brand: z.enum(BRAND_KEYS as [string, ...string[]], { message: "Escolha a marca." }),
  channel: z.enum(Object.keys(CHANNELS) as [string, ...string[]], { message: "Escolha o canal." }),
  service_id: optId,
  campaign_id: optId,
  instruction,
});

/** Nova peça a partir da descrição: cria o rascunho e já pede a arte à IA. */
export async function createPieceWithAiAction(_prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  const values = formToObject(formData);
  if (!aiConfigured()) return { values, error: NOT_CONFIGURED };
  const parsed = newSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrors(parsed.error), error: "Revise os campos destacados." };
  const { refs, error: refError } = await readReferences(formData);
  if (refError) return { values, fieldErrors: { references: refError }, error: refError };
  const { instruction: text, ...briefing } = parsed.data;
  const theme = text.replace(/\s+/g, " ").slice(0, 157) + (text.length > 157 ? "…" : "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comm_pieces")
    .insert({ ...briefing, theme, show_slogan: true, show_contacts: false, is_test: !isProduction })
    .select("id")
    .single();
  if (error || !data) return { values, error: "Não foi possível criar a peça." };
  const fail = await startRequest(supabase, data.id, "criar", text, refs);
  if (fail !== "") return { values, error: "A peça foi criada, mas o pedido à IA não pôde ser registrado. Abra a peça e tente de novo." };
  revalidatePath("/comunicacao");
  redirect(`/comunicacao/pecas/${data.id}?ia=1`);
}

/** Criar (sem arte ainda) ou ajustar a arte da peça em rascunho. */
export async function requestArtAction(pieceId: string, _prev: CommState, formData: FormData): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  if (!uuidRe.test(pieceId)) return { error: "Peça inválida." };
  const values = formToObject(formData);
  if (!aiConfigured()) return { values, error: NOT_CONFIGURED };
  const parsed = instruction.safeParse(values.instruction ?? "");
  if (!parsed.success) return { values, fieldErrors: { instruction: parsed.error.issues[0].message }, error: "Revise a descrição." };
  const { refs, error: refError } = await readReferences(formData);
  if (refError) return { values, fieldErrors: { references: refError }, error: refError };
  const supabase = await createClient();
  const { data: p } = await supabase.from("comm_pieces").select("art_id, status").eq("id", pieceId).maybeSingle();
  if (!p) return { error: "Peça não encontrada." };
  const fail = await startRequest(supabase, pieceId, p.art_id ? "ajustar" : "criar", parsed.data, refs);
  if (fail === null) return { values, error: "Não foi possível registrar o pedido à IA." };
  if (fail) return { values, error: fail };
  revalidatePath(`/comunicacao/pecas/${pieceId}`);
  return { ok: "Pedido enviado à IA. A arte aparece aqui em 1 a 3 minutos.", seq: Date.now() };
}

/** Volta para o layout padrão (sem a arte da IA), mantendo os textos. A arte continua guardada no histórico. */
export async function removeArtAction(pieceId: string): Promise<CommState> {
  await requireAppUser(COMMUNICATE);
  if (!uuidRe.test(pieceId)) return { error: "Peça inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("comm_pieces").update({ art_id: null }).eq("id", pieceId).eq("status", "rascunho").select("id");
  if (error || !data?.length) return { error: "Só rascunhos podem ser alterados." };
  revalidatePath(`/comunicacao/pecas/${pieceId}`);
  return { ok: "A peça voltou ao layout padrão.", seq: Date.now() };
}
