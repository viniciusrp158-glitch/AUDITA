/**
 * SOMENTE DESENVOLVIMENTO — libera alguns serviços com decisão FICTÍCIA para homologar a emissão de propostas
 * (decisão do Diretor em 09/10/2026). Usa o fluxo normal do catálogo: fundamento obrigatório e histórico imutável.
 * Recusa-se a rodar fora do projeto Supabase de desenvolvimento.
 * Uso: node scripts/dev-liberar-servicos-teste.mjs   (com .env.local carregado)
 */
import { createClient } from "@supabase/supabase-js";

const DEV_REF = "avfqgxckcclzktrojynj";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes(DEV_REF) || process.env.NEXT_PUBLIC_APP_ENV === "producao") {
  console.error("Abortado: este script só pode ser executado no ambiente de desenvolvimento.");
  process.exit(1);
}
const CODES = ["SST-001", "SST-009", "DOC-002", "TRN-001", "TRN-NR06"];
const BASIS =
  "[TESTE] Liberação fictícia, somente no ambiente de desenvolvimento, para homologar a emissão de propostas. " +
  "Não representa decisão comercial real (decisão do Diretor de 09/10/2026).";

const db = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "audita" },
  auth: { persistSession: false },
});
const { error: authError } = await db.auth.signInWithPassword({
  email: process.env.TEST_ADMIN_EMAIL,
  password: process.env.TEST_ADMIN_PASSWORD,
});
if (authError) throw authError;

for (const code of CODES) {
  const { data: s } = await db.from("services").select("id, commercial_status").eq("service_code", code).single();
  if (s.commercial_status === "apto_comercialmente") {
    console.log(`${code}: já liberado`);
    continue;
  }
  const { error } = await db
    .from("services")
    .update({ commercial_status: "apto_comercialmente", status_basis: BASIS, status_reference: "Ambiente de desenvolvimento — teste" })
    .eq("id", s.id);
  console.log(`${code}: ${error ? "ERRO " + error.message : "liberado (teste)"}`);
}
