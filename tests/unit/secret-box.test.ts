/** Cofre de segredos do servidor (regra 9): cifra, decifra e recusa texto adulterado ou chave errada. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { open, seal, secretsConfigured } from "@/lib/secret-box";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

describe("Cofre de segredos", () => {
  const prev = process.env.AUDITA_SECRETS_KEY;
  beforeEach(() => {
    process.env.AUDITA_SECRETS_KEY = KEY_A;
  });
  afterEach(() => {
    process.env.AUDITA_SECRETS_KEY = prev;
  });

  it("cifra e decifra; o texto cifrado não contém o segredo e muda a cada vez", () => {
    const a = seal("xkeysib-SEGREDO-DE-TESTE");
    const b = seal("xkeysib-SEGREDO-DE-TESTE");
    expect(a).not.toContain("SEGREDO");
    expect(a).not.toBe(b);
    expect(open(a)).toBe("xkeysib-SEGREDO-DE-TESTE");
  });
  it("recusa texto adulterado e chave diferente", () => {
    const a = seal("segredo");
    const parts = a.split(".");
    parts[3] = Buffer.from("outro").toString("base64url");
    expect(() => open(parts.join("."))).toThrow();
    process.env.AUDITA_SECRETS_KEY = KEY_B;
    expect(() => open(a)).toThrow();
  });
  it("sem a chave no servidor, não cifra", () => {
    process.env.AUDITA_SECRETS_KEY = "";
    expect(secretsConfigured()).toBe(false);
    expect(() => seal("x")).toThrow(/AUDITA_SECRETS_KEY/);
  });
});
