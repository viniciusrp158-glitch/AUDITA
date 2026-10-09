# Histórico de desenvolvimento — AUDITA

## Decisões aprovadas pelo Diretor (09/10/2026)

| # | Decisão |
|---|---|
| D-01 | Desenvolvimento e testes em projeto Supabase separado (`audita-dev`); mesmas migrações irão ao projeto corporativo após validação. |
| D-02 | Estrutura própria, separada do Audita PRO (cadastro de clientes e códigos próprios). |
| D-03 | Repositório `viniciusrp158-glitch/AUDITA`. |
| D-04 | Desenvolvimento com instalação de pacotes no computador do Diretor (pasta Documentos\AUDITA). |
| D-05 | Vercel (time AUDITAPRO) para previews. |
| D-06 | Ajustes G-01 a G-10 do S0 aprovados, incluindo cálculo decimal exato e margens com 4 casas (fórmulas AUDDOC011 inalteradas). |
| — | Nome do sistema: **AUDITA**. Dados fictícios permitidos para testes, sempre identificados. |

## I1 — Fundação (em validação)

**Objetivo:** aplicação base, login protegido, lista de autorizados, trilha de auditoria e layout institucional.
**Requisitos:** AUDDOC017 RF-01, RF-08 (parcial), §4, §10, §15; CA-01, CA-10 (parcial), CA-12.

Entregue:
- Migrações `20261009170036_i1_fundacao` e `20261009170134_i1_expor_schema_api` aplicadas em `audita-dev`.
- Login, saída, recuperação e redefinição de senha; página de acesso negado; sessão validada no servidor.
- Menu lateral com as 7 áreas do AUDDOC017 §4; páginas dos módulos futuros sem dados simulados.
- Registro de atividades (Configurações → Registro de atividades).
- Usuários fictícios no ambiente de desenvolvimento: `admin.teste@audita.test` (autorizado) e `intruso.teste@audita.test` (autenticado, sem autorização).

### Evidências de teste (09/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | sem erros |
| `eslint src tests` | sem erros |
| `next build` | sucesso (14 rotas) |
| Vitest — unitários (formatação pt-BR/fuso) | 2/2 |
| Vitest — acesso por chamada direta à API (anônimo, autenticado sem autorização, administrador, imutabilidade da trilha) | 7/7 |
| Playwright — redirecionamento sem sessão, senha incorreta, usuário não autorizado, fluxo do administrador, layout no celular | 5/5 |
| Supabase advisors (segurança) | apenas "proteção contra senhas vazadas" desativada (configuração do painel) |

### Pendências do I1

- Configurar no painel do Supabase (`audita-dev`): desativar cadastro público; URL do site e URLs de redirecionamento para a recuperação de senha.
- Vercel: autorizar o app da Vercel no GitHub para o repositório AUDITA (necessário para criar o projeto e os previews).
- Criar o usuário administrador real do Diretor (após a configuração de URLs, para definir a senha pelo link de recuperação).
- MFA (TOTP) do administrador: previsto para depois do I1.
