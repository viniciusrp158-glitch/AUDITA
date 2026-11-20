import "server-only";
/**
 * Cofre de segredos do servidor (regra 9: nenhuma chave privilegiada no navegador nem no Git). Cifra com AES-256-GCM
 * usando AUDITA_SECRETS_KEY (64 caracteres hexadecimais), que existe só no ambiente do servidor; o banco guarda apenas
 * o texto cifrado. Usado para a chave do Brevo da prospecção.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const hex = process.env.AUDITA_SECRETS_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("AUDITA_SECRETS_KEY ausente ou inválida no servidor");
  return Buffer.from(hex, "hex");
}

export const secretsConfigured = () => /^[0-9a-f]{64}$/i.test(process.env.AUDITA_SECRETS_KEY ?? "");

/** "v1.<iv>.<tag>.<cifrado>" em base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Segredo em formato desconhecido");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}
