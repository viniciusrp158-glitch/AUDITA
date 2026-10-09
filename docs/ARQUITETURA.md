# Arquitetura — AUDITA

Detalhamento completo e decisões: documento **S0 — Diagnóstico e Planejamento Técnico v0.1** (projeto "Sistema AUDITA de Operação").

## Camadas

```
Navegador ──HTTPS/cookie──▶ Next.js (Vercel)
                              ├─ middleware: renova sessão; sem usuário ⇒ /login
                              ├─ (app)/layout: exige usuário em audita.app_users (servidor)
                              ├─ Server Actions: validação zod, regras de negócio
                              └─ Supabase client (JWT do usuário, schema `audita`) ──▶ Postgres + RLS
```

## Autenticação e autorização

- Supabase Auth (e-mail e senha). Cadastro público deve permanecer **desativado** no painel.
- Autorização = linha ativa em `audita.app_users` (papel `admin` no MVP). Usuários autenticados de outros sistemas recebem `/sem-acesso` e a tentativa é registrada.
- Verificação sempre no servidor (layout protegido + RLS); esconder botões não é controle de acesso.

## Banco (`audita`)

| Objeto | Função |
|---|---|
| `app_users` | Usuários autorizados |
| `audit_log` | Trilha somente-inclusão (gatilho bloqueia UPDATE/DELETE) |
| `current_app_role()`, `is_admin()` | Base das políticas RLS |
| `log_row_change()` | Gatilho genérico: registra apenas campos alterados |
| `log_access_event(event)` | Login, logout e acesso negado |

O schema é exposto à API pela configuração `pgrst.db_schemas` (migração `i1_expor_schema_api`). Em projeto compartilhado, **acrescentar** `audita` à lista existente.

## Segurança na aplicação

- Cabeçalhos: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `noindex`.
- Mensagens de login genéricas (não revelam se o e-mail existe).
- Senha nova: mínimo de 12 caracteres com letras e números.
