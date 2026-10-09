import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

/** Token aleatório de 256 bits (43 caracteres base64url). Exibido uma única vez; o banco guarda só o hash. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Origem pública do sistema, a partir da requisição atual (funciona em preview e produção). */
export async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export type InviteStatus = "enviado" | "preenchido" | "expirado" | "cancelado";

export function inviteStatus(i: { used_at: string | null; cancelled_at: string | null; expires_at: string }, now = Date.now()): InviteStatus {
  if (i.used_at) return "preenchido";
  if (i.cancelled_at) return "cancelado";
  if (new Date(i.expires_at).getTime() <= now) return "expirado";
  return "enviado";
}
