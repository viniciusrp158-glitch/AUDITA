"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Envio direto do navegador para um link assinado gerado pelo servidor (o servidor decide o caminho e autoriza
 * um único envio). Usa apenas a chave pública; nenhuma sessão ou chave privilegiada no navegador.
 */
export async function uploadToSignedUrl(bucket: string, path: string, token: string, file: File) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
}
