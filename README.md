# AUDITA — Sistema administrativo interno

**AUDITA | SSMA & SGI** · Gestão inteligente para ambientes mais seguros.

Backoffice privado da AUDITA para clientes, demandas, orçamentos (AUDDOC011), propostas (AUDDOC010),
biblioteca documental e indicadores. Especificação oficial: **AUDDOC017 — Rev.00**.

> Este repositório **não** contém o Audita PRO nem o Audita HUB e não deve acessar suas tabelas.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres com RLS, Storage) · Vitest · Vercel.

## Ambientes

| Ambiente | Supabase | Dados |
|---|---|---|
| Desenvolvimento | projeto `audita-dev` (sa-east-1) | somente fictícios |
| Produção | projeto corporativo, schema `audita` | reais — **somente após autorização do Diretor** |

## Executar localmente

```bash
cp .env.example .env.local   # preencher URL e chave publicável do projeto de desenvolvimento
npm install
npm run dev                  # http://localhost:3000
```

## Verificações

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration     # requer variáveis TEST_* (usuários fictícios do ambiente de desenvolvimento)
```

## Banco de dados

- Todas as tabelas ficam no schema **`audita`** (nada em `public`).
- Migrações em `supabase/migrations/` — aditivas, versionadas e aplicadas na mesma ordem em cada ambiente.
- RLS em todas as tabelas; acesso só para usuários listados em `audita.app_users`.

## Documentação

- `docs/HISTORICO.md` — histórico de desenvolvimento, decisões e pendências.
- `docs/ARQUITETURA.md` — arquitetura, segurança e convenções.
- `CLAUDE.md` — regras para quem (pessoa ou IA) continuar o desenvolvimento.
