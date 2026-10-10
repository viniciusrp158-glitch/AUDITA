/**
 * I9 — CA-12 (AUDDOC017 §16): não existem chamadas, chaves, alterações ou migrações do Audita PRO / HUB no escopo inicial.
 * Varredura estática do repositório: migrações, código, roteiros e testes.
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const MIG = join(ROOT, "supabase", "migrations");
const migrations = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
const strip = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\$\$[\s\S]*?\$\$/g, (body) => body); // corpo de função é analisado junto
const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

describe("CA-12 — escopo isolado do Audita PRO / HUB", () => {
  it("toda migração cria ou altera objetos somente no schema audita (e apenas buckets/políticas próprias no Storage)", () => {
    const problems: string[] = [];
    const ddl =
      /\b(create(?:\s+or\s+replace)?\s+(?:table|view|materialized\s+view|function|procedure|type|sequence|schema|trigger\s+\w+[\s\S]*?\bon)|alter\s+(?:table|function|view|type|sequence|schema)|insert\s+into|update|delete\s+from|truncate|drop\s+(?:table|view|function|schema|type|policy|trigger|index))\s+(?:if\s+(?:not\s+)?exists\s+)?([a-z_]+)\.([a-z_]+)/gi;
    for (const f of migrations) {
      const sql = strip(readFileSync(join(MIG, f), "utf8"));
      for (const m of sql.matchAll(ddl)) {
        const [, verb, schema, obj] = m;
        const okAudita = schema.toLowerCase() === "audita";
        const okStorage = schema.toLowerCase() === "storage" && /^insert\s+into$/i.test(verb.replace(/\s+/g, " ")) && obj === "buckets";
        if (!okAudita && !okStorage) problems.push(`${f}: ${verb.split(/\s+/).slice(0, 3).join(" ")} ${schema}.${obj}`);
      }
      for (const p of sql.matchAll(/create\s+policy\s+(\w+)\s+on\s+([a-z_]+)\.([a-z_]+)/gi)) {
        const [, name, schema, table] = p;
        const ok = schema === "audita" || (schema === "storage" && table === "objects" && name.startsWith("audita_"));
        if (!ok) problems.push(`${f}: política ${name} em ${schema}.${table}`);
      }
      if (/\bpublic\.[a-z_]+/i.test(sql)) problems.push(`${f}: referência ao schema public (Audita PRO)`);
    }
    expect(problems).toEqual([]);
  });

  it("nenhuma migração destrutiva (DROP TABLE/SCHEMA/COLUMN, TRUNCATE)", () => {
    const bad = migrations.filter((f) => /(^|;)\s*(drop\s+(table|schema)\b|alter\s+table[^;]*\bdrop\s+column\b|truncate\b)/im.test(strip(readFileSync(join(MIG, f), "utf8"))));
    expect(bad).toEqual([]);
  });

  it("código, roteiros e testes não chamam domínios nem projetos do PRO/HUB", () => {
    const code = tracked.filter((f) => /^(src|scripts|tests|supabase)\//.test(f) && /\.(ts|tsx|mjs|js|json|sql)$/.test(f) && !f.endsWith("ca12-escopo.test.ts"));
    const hits = code.filter((f) => /auditapro\.app\.br|auditahub\.app\.br|auditapro\.vercel|auditahub\.vercel/i.test(readFileSync(join(ROOT, f), "utf8")));
    expect(hits).toEqual([]);
  });

  it("nenhuma chave ou segredo versionado no Git (.env, service_role, chaves secretas, JWT)", () => {
    expect(tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example"))).toEqual([]);
    const text = tracked.filter((f) => !/\.(png|jpe?g|svg|ico|docx|xlsx|pptx|pdf|ttf|woff2?)$/i.test(f) && !f.includes("embedded.ts"));
    const leaks = text.filter((f) => {
      const s = readFileSync(join(ROOT, f), "utf8");
      return /sb_secret_[A-Za-z0-9]/.test(s) || /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(s) || /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S/.test(s);
    });
    expect(leaks).toEqual([]);
  });
});
