/**
 * I9 — Homologação: varredura completa de segurança por chamada direta à API (AUDDOC017 §10, CA-01, CA-10).
 * A lista de tabelas vem do próprio banco (security_self_check), então toda tabela nova entra no teste automaticamente.
 * Projeto de DESENVOLVIMENTO, usuários fictícios.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ready = Boolean(url && key && process.env.TEST_ADMIN_EMAIL && process.env.TEST_INTRUSO_EMAIL);

const client = () => createClient(url!, key!, { db: { schema: "audita" }, auth: { persistSession: false, autoRefreshToken: false } });
async function signedIn(email: string, password: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha no login de teste (${email}): ${error.message}`);
  return c;
}

type Check = {
  tables: { name: string; rls: boolean; policies: number; anon_privileges: string[]; public_privileges: string[] }[];
  views: string[];
  functions: { name: string; security_definer: boolean; search_path_empty: boolean; anon_execute: boolean }[];
  buckets: { id: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }[];
  storage_policies: { name: string; cmd: string; roles: string[] | string }[];
};

/** Únicas funções públicas permitidas (CLAUDE.md regra 4): autocadastro por link. */
const ANON_FUNCTIONS = ["invite_context", "submit_registration"];

describe.skipIf(!ready)("I9 — varredura de segurança (RLS, permissões, Storage)", () => {
  type C = ReturnType<typeof client>;
  let anon: C;
  let admin: C;
  let intruso: C;
  let check: Check;

  beforeAll(async () => {
    anon = client();
    admin = await signedIn(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    intruso = await signedIn(process.env.TEST_INTRUSO_EMAIL!, process.env.TEST_INTRUSO_PASSWORD!);
    const r = await admin.rpc("security_self_check");
    if (r.error) throw new Error(r.error.message);
    check = r.data as Check;
  });

  it("autoverificação só para o administrador", async () => {
    expect((await anon.rpc("security_self_check")).error).not.toBeNull();
    expect((await intruso.rpc("security_self_check")).error?.code).toBe("42501");
    expect(check.tables.length).toBeGreaterThanOrEqual(21);
  });

  it("toda tabela tem RLS ligada, ao menos uma política e nenhum privilégio para anon ou PUBLIC; sem views expostas", () => {
    const bad = check.tables.filter((t) => !t.rls || t.policies < 1 || t.anon_privileges.length > 0 || t.public_privileges.length > 0);
    expect(bad, JSON.stringify(bad)).toEqual([]);
    expect(check.views).toEqual([]);
  });

  it("toda função com search_path vazio; anon só executa as duas funções do autocadastro", () => {
    expect(check.functions.filter((f) => !f.search_path_empty).map((f) => f.name)).toEqual([]);
    expect(check.functions.filter((f) => f.anon_execute).map((f) => f.name).sort()).toEqual(ANON_FUNCTIONS);
  });

  it("buckets privados com limite de tamanho e tipos; Storage sem política de alteração ou exclusão", () => {
    expect(check.buckets.map((b) => b.id)).toEqual(["audita-biblioteca", "audita-documentos"]);
    for (const b of check.buckets) {
      expect(b.public).toBe(false);
      expect(b.file_size_limit).toBeGreaterThan(0);
      expect(b.allowed_mime_types?.length).toBeGreaterThan(0);
    }
    expect(check.storage_policies.every((p) => ["SELECT", "INSERT"].includes(p.cmd))).toBe(true);
    expect(check.storage_policies.every((p) => String(p.roles).replace(/[{}]/g, "") === "authenticated")).toBe(true);
    expect(check.storage_policies).toHaveLength(4);
  });

  it("chamada direta, tabela por tabela: anônimo e usuário não autorizado não leem, não inserem, não alteram, não excluem", async () => {
    const problems: string[] = [];
    for (const { name } of check.tables) {
      // anônimo: nem leitura
      const a = await anon.from(name).select("*").limit(1);
      if (!a.error) problems.push(`${name}: anônimo leu (${a.data?.length} linha)`);
      // usuário autenticado sem cadastro no AUDITA: zero linhas ou erro
      const r = await intruso.from(name).select("*").limit(5);
      if (!r.error && (r.data?.length ?? 0) > 0) problems.push(`${name}: intruso leu ${r.data!.length} linha(s)`);
      const ins = await intruso.from(name).insert({});
      if (!ins.error) problems.push(`${name}: intruso inseriu`);
      // alteração/exclusão contra uma linha real (vista pelo administrador), que precisa continuar intacta
      const sample = await admin.from(name).select("*").limit(1);
      const row = sample.data?.[0] as Record<string, unknown> | undefined;
      if (row && "id" in row) {
        const up = await intruso.from(name).update({ id: row.id }).eq("id", row.id).select();
        if (!up.error && (up.data?.length ?? 0) > 0) problems.push(`${name}: intruso alterou`);
        const del = await intruso.from(name).delete().eq("id", row.id).select();
        if (!del.error && (del.data?.length ?? 0) > 0) problems.push(`${name}: intruso excluiu`);
        const still = await admin.from(name).select("id").eq("id", row.id);
        if ((still.data?.length ?? 0) !== 1) problems.push(`${name}: linha de referência sumiu`);
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it("arquivos: anônimo e não autorizado não listam nem baixam; ninguém sobrescreve ou apaga", async () => {
    for (const bucket of ["audita-documentos", "audita-biblioteca"]) {
      const prefix = bucket === "audita-documentos" ? "quotes" : "library";
      const top = await admin.storage.from(bucket).list(prefix, { limit: 1 });
      expect(top.error).toBeNull();
      // desce até o primeiro arquivo
      let path = `${prefix}/${top.data![0].name}`;
      for (let i = 0; i < 4; i++) {
        const l = await admin.storage.from(bucket).list(path, { limit: 1 });
        if (!l.data?.length) break;
        const next = `${path}/${l.data[0].name}`;
        if (l.data[0].id) {
          path = next;
          break;
        }
        path = next;
      }
      const original = await admin.storage.from(bucket).download(path);
      expect(original.error, `${bucket}/${path}`).toBeNull();
      const bytes = Buffer.from(await original.data!.arrayBuffer());

      for (const who of [anon, intruso]) {
        expect((await who.storage.from(bucket).list(prefix)).data ?? []).toEqual([]);
        expect((await who.storage.from(bucket).download(path)).error).not.toBeNull();
        expect((await who.storage.from(bucket).createSignedUrl(path, 60)).error).not.toBeNull();
        expect((await who.storage.from(bucket).upload(`${prefix}/intruso.txt`, "x")).error).not.toBeNull();
      }
      // nem o administrador sobrescreve ou apaga (revisões são imutáveis)
      expect((await admin.storage.from(bucket).upload(path, "adulterado", { upsert: true })).error).not.toBeNull();
      await admin.storage.from(bucket).remove([path]);
      const after = await admin.storage.from(bucket).download(path);
      expect(Buffer.from(await after.data!.arrayBuffer()).equals(bytes)).toBe(true);
    }
  }, 60_000);
});
