"use server";

/**
 * Busca global (Frente A, A4): clientes, leads, demandas, orçamentos, documentos e treinamentos numa só caixa.
 * Usa as colunas search_text (minúsculas, sem acento) e os índices trigrama já existentes. Cada consulta passa pela
 * RLS do usuário; os grupos só do administrador nem são consultados para os outros níveis.
 */
import { getAppUser } from "@/lib/auth";
import { normalizeSearch } from "@/lib/clients/queries";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/pricing/labels";
import { isStage, STAGE_LABEL } from "@/lib/prospect/labels";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = { group: string; href: string; title: string; detail: string };

const PER_GROUP = 5;

export async function globalSearch(raw: string): Promise<SearchHit[]> {
  const term = normalizeSearch(String(raw ?? ""));
  if (term.length < 2) return [];
  const user = await getAppUser();
  if (!user || (user.role !== "admin" && user.role !== "operador")) return [];
  const admin = user.role === "admin";
  // Cada palavra precisa aparecer, em qualquer ordem ("ac gesso" acha "AC. GESSO LTDA"); até 5 palavras
  const words = term.split(" ").filter((w) => w.length > 0).slice(0, 5);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const each = <Q extends { ilike: (c: string, p: string) => any }>(q: Q, col: string): Q => words.reduce((acc, w) => acc.ilike(col, `%${w}%`), q);
  const supabase = await createClient();

  const [clients, leads, demands, quotesByCode, quotesByClient, docs, courses] = await Promise.all([
    each(supabase.from("clients").select("id, client_code, legal_name, trade_name, status"), "search_text").order("legal_name").limit(PER_GROUP),
    each(supabase.from("leads").select("id, legal_name, trade_name, stage"), "search_text").eq("status", "ativo").order("legal_name").limit(PER_GROUP),
    each(supabase.from("demands").select("id, demand_code, summary, clients(legal_name)"), "search_text").order("received_on", { ascending: false }).limit(PER_GROUP),
    supabase.from("quotes").select("id, quote_code, status, clients(legal_name)").ilike("quote_code", `%${term.replace(/ /g, "%")}%`).order("quote_code", { ascending: false }).limit(PER_GROUP),
    each(supabase.from("quotes").select("id, quote_code, status, clients!inner(legal_name, search_text)"), "clients.search_text").order("quote_code", { ascending: false }).limit(PER_GROUP),
    admin ? each(supabase.from("library_documents").select("id, doc_code, title"), "search_text").order("doc_code").limit(PER_GROUP) : Promise.resolve({ data: [] }),
    admin ? each(supabase.from("training_courses").select("id, course_code, title"), "search_text").order("title").limit(PER_GROUP) : Promise.resolve({ data: [] }),
  ]);

  const name = (c: unknown) => (c && typeof c === "object" && "legal_name" in c ? String((c as { legal_name: string }).legal_name) : "");
  const out: SearchHit[] = [];
  for (const c of clients.data ?? [])
    out.push({ group: "Clientes", href: `/clientes/${c.id}`, title: c.trade_name || c.legal_name, detail: `${c.client_code}${c.status === "inativo" ? " · inativo" : ""}` });
  for (const l of leads.data ?? [])
    out.push({ group: "Leads da prospecção", href: `/prospeccao/leads/${l.id}`, title: l.trade_name || l.legal_name, detail: isStage(l.stage) ? STAGE_LABEL[l.stage] : l.stage });
  for (const d of demands.data ?? [])
    out.push({ group: "Demandas", href: `/demandas/${d.id}`, title: `${d.demand_code} — ${d.summary}`, detail: name(d.clients) });
  const seen = new Set<string>();
  for (const q of [...(quotesByCode.data ?? []), ...(quotesByClient.data ?? [])]) {
    if (seen.has(q.id) || seen.size >= PER_GROUP) continue;
    seen.add(q.id);
    out.push({ group: "Orçamentos", href: `/orcamentos/${q.id}`, title: q.quote_code, detail: `${name(q.clients)} · ${QUOTE_STATUS[q.status as QuoteStatus]?.label ?? q.status}` });
  }
  for (const d of (docs.data ?? []) as { id: string; doc_code: string; title: string }[])
    out.push({ group: "Biblioteca", href: `/biblioteca/${d.id}`, title: d.doc_code, detail: d.title });
  for (const c of (courses.data ?? []) as { id: string; course_code: string; title: string }[])
    out.push({ group: "Audita Academy", href: `/treinamentos/${c.id}`, title: c.title, detail: c.course_code });
  return out;
}
