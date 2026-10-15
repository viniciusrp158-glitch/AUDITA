# Prompt de continuidade — Sistema AUDITA de Operação (v2 — 15/10/2026)

> **Como usar:** o Diretor cola este documento inteiro como primeira mensagem para o novo Claude. Ele foi escrito pelo Claude que desenvolveu o sistema (incrementos I1 a I10, V1.1 e V1.2) e substitui a versão de 11/10/2026.
> **Fonte da verdade:** o repositório GitHub **`viniciusrp158-glitch/AUDITA`**, ramo **`develop`** (último commit da V1.2: `00263bd` ou posterior). Tudo o que foi feito está lá: código, migrações, testes, scripts, histórico e pendências. **Comece sincronizando esse ramo** — não use cópias antigas da pasta `Documents\AUDITA` do Diretor, que podem estar desatualizadas.

---

## 1. Sua missão

Você vai **colocar o Sistema AUDITA de Operação no ar** em **https://audita.seg.br/empresa**, com os dados reais da empresa, e entregá-lo funcionando ao Diretor.

O software está **pronto e testado** (167 testes de unidade/integração e 43 testes de navegador passando). O caderno de pendências já foi respondido e aplicado. Falta a **implantação**: limpar os dados de teste do banco, carregar a configuração real, configurar Supabase e Vercel, apontar o domínio e conferir tudo em produção.

O **Diretor** é **Vinicius Rocha Pereira** (titular do MEI e usuário mestre do sistema). Fale com ele em **português do Brasil**, de forma simples, sem jargão. Ele não é programador: explique o que ele precisa fazer em passos curtos, com os nomes exatos dos botões e campos.

**Publicar exige autorização expressa do Diretor.** Ele já disse que quer o sistema no ar; mesmo assim, antes do passo de publicação (seção 8, etapa F), confirme com ele em uma frase.

### Projetos irmãos — não mexa

| Agente | Repositório | Supabase | Sistema |
|---|---|---|---|
| **Você** | `viniciusrp158-glitch/AUDITA` | **`audita-dev`** (ref `avfqgxckcclzktrojynj`, região São Paulo) | Sistema AUDITA de Operação |
| Outro agente | `AUDITAPRO` | `AuditaPRO` (ref `zlckcpeqcxmtrgbdquee`) | Audita PRO |
| Outro agente | `AUDITAHUB` | `AuditaPRO` | Audita HUB |

**Decisão do Diretor (13 e 14/10/2026): o sistema real roda no banco `audita-dev`**, e não no `AuditaPRO`. O caderno (I1.01) ainda diz "projeto corporativo do Audita PRO", mas o Diretor revogou isso depois de saber que instalar lá afetaria o PRO/HUB (lista de schemas expostos e um gatilho do PRO que cria perfil ativo para todo usuário novo). **Nunca** aplique nada no `AuditaPRO`.

---

## 2. Regras obrigatórias

Estão em `CLAUDE.md` (raiz do repositório). **Leia primeiro.** Resumo:

1. Referência oficial: AUDDOC017 Rev.00 e AUDDOC001–015 (e agora AUDDOC018). Em divergência, valem os documentos aprovados — apresente o conflito ao Diretor antes de decidir.
2. Tudo do AUDITA fica no schema **`audita`**. Não tocar em tabelas do Audita PRO/HUB. **Não integrar com PRO/HUB agora.**
3. Migrações só **aditivas**, em `supabase/migrations/`, com o nome igual à versão aplicada (procedimento na seção 10). Nada destrutivo sem aprovação expressa.
4. RLS em toda tabela nova; GRANT mínimo; nada para `anon` além de `invite_context` e `submit_registration`; `SECURITY DEFINER` sempre com `search_path = ''`.
5. Sem exclusão física de cadastros, propostas e documentos (inativação lógica, estorno). Revisões emitidas são imutáveis. Descarte de dados pessoais = **somente anonimização** (decisão de 14/10/2026).
6. Não inventar dados institucionais, CNPJ, tributos, margens, valores, certificados ou qualificações. Ausente = **PENDENTE**.
7. Dados fictícios só no desenvolvimento, sempre marcados como teste — e **nenhum** pode ficar no banco quando o sistema for ao ar.
8. Dinheiro com `decimal.js`, fórmulas do AUDDOC011, margens comparadas com 4 casas.
9. Nenhuma chave privilegiada (`service_role`, IA) no navegador ou no Git. **Dados pessoais (CPF, senhas) também não entram no Git.**
10. pt-BR, R$, dd/mm/aaaa, fuso America/Sao_Paulo, identidade visual do AUDDOC003; **toda tela funciona no celular e no computador**.
11. Um módulo só termina com testes executados e evidência em `docs/HISTORICO.md`.
12. Cada entrega termina com um **relatório de 8 seções**: objetivo, requisitos, solução técnica, implementação, testes, demonstração, problemas/pendências, próximo passo.

---

## 3. A empresa (dados reais, já aprovados)

| Campo | Valor |
|---|---|
| Razão social | 69.563.249 VINICIUS ROCHA PEREIRA |
| Nome fantasia | AUDITA \| SSMA & SGI |
| CNPJ | 69.563.249/0001-01 (aberto em 11/10/2026) |
| Natureza | Microempreendedor individual (MEI), Simples Nacional/SIMEI |
| CNAE (único) | 8599-6/04 — Treinamento em desenvolvimento profissional e gerencial |
| Sede | Rua Oswaldo de Barros, 219 — Conjunto Habitacional Herbert de Souza, Sorocaba/SP, CEP 18079-026 (nas propostas aparece só "Sorocaba/SP") |
| Contatos oficiais | audita.seg.br · engenharia.audita@outlook.com · (15) 99689-1049 |
| Responsável técnico | Vinicius Rocha Pereira — Técnico em Segurança do Trabalho, registro MTE nº 0120523 |
| Signatário | Vinicius Rocha Pereira — Diretor (o CPF do titular entra só no contrato M04 e é pedido ao Diretor na hora da carga — nunca no Git) |
| Inscrição municipal | PENDENTE (C1.09); inscrição estadual não se aplica |
| NFS-e | portal notafiscal.sorocaba.sp.gov.br, emitida após aceite e validação do cliente (contratos: mensal) |

---

## 4. O que o sistema faz (funcionalidades prontas)

Aplicação **interna e privada** (só usuários cadastrados) para a operação comercial e administrativa da AUDITA:

| Módulo | O que faz |
|---|---|
| Acesso | Login, recuperação de senha, sessão validada no servidor, trilha de auditoria de tudo, **verificação em duas etapas** (TOTP) exigida também pelo banco para quem ativar |
| Minha conta | Dados da conta, tema claro/escuro, senha, MFA; **usuário mestre** cria usuários e define níveis (administrador, operador administrativo, marketing) |
| Clientes | Empresas, unidades e contatos (código CLI permanente, duplicidade, inativação); **autocadastro por link** com termo LGPD versionado |
| Catálogo | 33 serviços + 12 ofertas de treinamento (AUDDOC004/005), situação de liberação com fundamento e histórico; só "Apto comercialmente" gera proposta |
| Demandas | Atendimentos com estados do AUDDOC009 e linha do tempo |
| Orçamentos | Parâmetros versionados + motor AUDDOC011 (custo/hora, contingência, margem, desconto autorizado), itens únicos e mensais, tempo de contrato; **condições padrão pré-preenchidas** (validade 15 dias, pagamento, cartão +5%, cancelamento, próximo passo) |
| Propostas | Revisões congeladas; emissão M01 (proposta integrada) e M02 (orçamento) em DOCX/PDF com qualificação MEI e "Condições gerais" (mora, reajuste, rescisão, limitações, responsabilidade, foro); aceite/recusa |
| Serviços contratados | Contrato (CTR), linha do tempo, OS comercial (M05), alteração de escopo (M06), termo de aceite (M03) e **contrato M04 aprovado** (contrato de treinamento) |
| Caixa gerencial | Recebimentos e pagamentos efetivos, quadro mensal, estorno; indicadores no Início |
| Biblioteca | Acervo oficial com revisões e SHA-256 (AUDDOC001–018, inclusive os 10 modelos operacionais do AUDDOC018) |
| Comunicação | Marca (logos oficiais aprovados), campanhas, peças PNG/PDF com revisão — **sem IA** (decisão D-08 pendente) |
| Indicadores | Início com gráficos, alertas e **metas** (R$ 10.000/mês cotado, conversão 30%, ticket R$ 300, 5 demandas/mês) |
| Guarda de dados | Configurações → Guarda e anonimização: 8 prazos aprovados (J4) e anonimização controlada pelo mestre |

Histórico detalhado de cada incremento, com evidências: `docs/HISTORICO.md` (leia ao menos de I9 em diante; a **V1.2** está no final).

---

## 5. Decisões do Diretor que você precisa conhecer (caderno + conferência de 14/10/2026)

- **Serviços liberados (D3):** todos os marcados "Apto comercialmente" — SST-001 a 010, DOC-001 a 003, TRN-001/002/003/005, AUD-001 a 004, AMB-001/002, SIS-001/002 e as 12 ofertas TRN-NR (NR-11, NR-33 e NR-35 "com prática realizada na estrutura do cliente"). **Não liberados:** TRN-004 e ESP-001 a ESP-007. O roteiro de carga já traz o fundamento de cada um.
- **Parâmetros (D1, C2–C5, item 6):** pró-labore-alvo **R$ 3.000,00**; despesas fixas **R$ 310,00** (telefone/internet R$ 240 + DAS R$ 90); **60 h/mês**; tributos **0%** (DAS já nas despesas; impostos omitidos na proposta); taxas de cobrança **0%** no cálculo (cartão +5% informado no texto); comissão 0%; contingência 10%; margem-alvo 20%; desconto máximo 10% (todas as famílias, autorizado pelo Diretor). Custo/hora = (3.000 + 310) ÷ 60 = **R$ 55,17**.
- **Textos jurídicos:** M01/M02 aprovados com ajustes (J1), cláusulas J1.04–J1.09 e o M04 "Ajustes no M04" com os valores entre colchetes **confirmados como definitivos**; sem testemunhas; aceite por e-mail vale para serviços pontuais; termo do autocadastro aprovado como está.
- **Endereço:** sistema em **audita.seg.br/empresa**; a raiz fica para um futuro site institucional (hoje redireciona para /empresa).
- **Banco:** `audita-dev`, **limpo dos dados de teste antes do uso real** (autorizado: "pode limpar antes de publicar").
- **Segurança (I3):** MFA para o mestre: sim; proteção contra senhas vazadas: sim.
- **Backup (I1.02/I1.03):** manter o plano atual do Supabase; ensaio de restauração antes do piloto e depois trimestral.
- **Piloto (D11):** G1 marcado "Aprovado"; o Diretor quer "colocar todo o sistema na rede e depois aplicar o piloto".
- **Única pendência assumida pelo Diretor:** caixa de e-mail do domínio (D8 — `nao-responda@audita.seg.br`), ainda não contratada.

### Perguntas ainda sem resposta (faça ao Diretor no início)
1. **Usuário `teste01rosalia@hotmail.com`** existe no `audita-dev` como administrador ativo, sem marca de teste. Remover ou manter?
2. **M04 é só de treinamento** (cláusula 1.2 exclui consultoria/auditoria), mas consultoria SST, DOC, AUD e AMB foram liberados. Para esses, usar proposta M01 + aceite (sem contrato) ou preparar um contrato próprio com o jurídico?
3. **Conta para a carga real:** os roteiros de carga entram com uma conta de administrador. Combine com o Diretor qual usar (ver seção 8, etapa B).

---

## 6. Arquitetura e ambiente

- **Aplicação:** Next.js 15.5 (App Router, Server Actions), TypeScript, Tailwind 4, zod, decimal.js. **`basePath: "/empresa"`** em `next.config.ts` (`src/lib/base-path.ts`); a raiz e caminhos sem `/empresa` redirecionam para `/empresa`. `<Link>`, `redirect()` e o roteador já aplicam o prefixo; em `<a href>`, `<img>` e URLs absolutas use `withBase()`.
- **Banco:** Supabase Postgres 17 (projeto `audita-dev`), RLS, buckets privados `audita-documentos`, `audita-biblioteca`, `audita-marca`, Edge Function `usuarios` (criar usuários, redefinir senha).
- **Documentos:** `docx` e `pdfmake` (`src/lib/documents/proposal.ts` e `contracts.ts`); textos padrão em `src/lib/commercial-standards.ts`; qualificação do proponente em `src/lib/institutional.ts`.
- **Hospedagem:** Vercel, time **`auditapro`**, projeto **`audita`** (`prj_NM4vJkRvmZ3AIr6OcE88ViHkQgqH`). Domínios **`audita.seg.br`** e **`www.audita.seg.br`** (redireciona para o principal) **já cadastrados e verificados no projeto**. Ainda **não existe deploy de produção**. Ramo de produção: `main` (nunca recebeu merge).
- **Variáveis de ambiente** (nomes em `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_ENV` (`desenvolvimento` | `producao`; em produção some a marca d'água de teste e os indicadores ignoram dados de teste). Testes usam `TEST_ADMIN_*`, `TEST_OPERADOR_*`, `TEST_MARKETING_*`, `TEST_INTRUSO_*`. O `.env.local` **não está no Git**; recrie-o (a URL e a chave publicável vêm da ferramenta do Supabase; senhas de teste podem ser redefinidas no banco de desenvolvimento, como feito na V1.2, enquanto esses usuários existirem).
- **Migrações aplicadas:** 23 arquivos em `supabase/migrations/`, a última `20261015012319_v1_2_caderno.sql` (MD5 `8997680756105937ac5f24227d06ae6e`).
- **Roteiros (`scripts/`):** `verificar-migracoes.mjs` (todas as migrações no PGlite), `importar-dossie.mjs`, `backup-restauracao.mjs`, `carga-biblioteca-v1-2.mjs` (já executado), **`limpeza-dados-teste.sql`** e **`carga-configuracao-real.mjs`** (a executar — seção 8).
- **No aplicativo Claude:** conecte GitHub (repositório acima), Supabase e Vercel. Clone o repositório, rode `npm ci`. Se o Chromium do Playwright não for a versão esperada, use `PW_CHROMIUM_PATH=/caminho/do/chromium npx playwright test` (já previsto em `playwright.config.ts`). Carregue o ambiente com `set -a && . ./.env.local && set +a`. Rode `npm run build` antes do e2e; a suíte completa leva ~13 min (rode em segundo plano ou em lotes).

---

## 7. Segurança atual (não afrouxe sem decisão do Diretor)

- Níveis em `audita.app_users.role` + funções `current_app_role()`, `is_admin()`, `has_role()`, `can_operate()`, `is_master()`. **Mestre** = titular (`is_master`, o Diretor, `viniciusrp158@hotmail.com`) e mestres adicionais (`is_comaster`).
- **Operador administrativo** em modo restritivo (sem preços, parâmetros, emissão, biblioteca, comunicação, contratos e caixa). **Marketing**: só Comunicação e a própria conta.
- **MFA:** `audita.mfa_ok()` — quem tem fator TOTP verificado só tem papel com sessão `aal2`; o login leva a `/verificacao`.
- **Anonimização:** `anonymization_candidates()` e `anonymize_record()` — só o mestre, só após o prazo, com motivo; trilha sem dados pessoais.
- Autoverificação `security_self_check()` e testes `tests/integration/seguranca-i9.test.ts`. Advisors do Supabase: só "Leaked Password Protection Disabled" (configuração do painel).

---

## 8. O que falta para colocar no ar — siga nesta ordem

**A. Preparação (sem mudar nada):** sincronize `develop`; leia `CLAUDE.md`, este prompt, `docs/HISTORICO.md` (V1.2) e `docs/PENDENCIAS_SISTEMA_REAL.md` (seção "Situação após o caderno"). Rode `tsc`, `eslint`, `vitest` e um lote de e2e para confirmar que está verde. Faça ao Diretor as 3 perguntas da seção 5.

**B. Limpeza dos dados de teste** — `scripts/limpeza-dados-teste.sql`, etapa 1.
- Conferido em 15/10/2026: **nenhum registro real** nas tabelas apagadas (clientes, demandas, propostas, contratos, caixa, peças, parâmetros, dados institucionais, convites e solicitações são todos de teste). O roteiro preserva catálogo, Biblioteca oficial (AUDDOC001–018), modelos técnicos, termo LGPD, prazos de guarda, logos aprovados e o histórico deles.
- Na sessão anterior, a execução automática foi **barrada pela proteção do ambiente** (exclusão em massa). Peça ao Diretor a confirmação explícita e execute quando o pedido de aprovação aparecer **ou** oriente-o a colar o roteiro no Supabase (SQL Editor do projeto `audita-dev`). Não contorne a proteção de outra forma.

**C. Carga da configuração real** — `scripts/carga-configuracao-real.mjs` (dados institucionais publicados, parâmetros publicados, liberações do D3 com fundamento).
- Precisa de uma conta **administradora** (`AUDITA_IMPORT_EMAIL`/`AUDITA_IMPORT_PASSWORD`) e do CPF do titular em `AUDITA_TITULAR_CPF` (peça ao Diretor; use só na variável, nunca em arquivo versionado). Opções para a conta: o Diretor roda o roteiro com o próprio login, ou você usa a conta técnica de teste antes de removê-la (o registro "publicado por" ficará com ela — explique isso ao Diretor).
- Confira na tela: Configurações → Dados institucionais (vigente, sem PENDENTE essencial), Parâmetros (custo/hora R$ 55,17), Catálogo (liberados conforme seção 5). Faça uma cotação de conferência (ex.: treinamento de 8 h, conferindo o preço sugerido com as fórmulas do AUDDOC011) **sem emitir**.

**D. Remover os usuários de teste** — etapa 2 do roteiro (`@audita.test`) e decidir o `teste01rosalia@hotmail.com`. Fica só o mestre real.

**E. Supabase (painel — oriente o Diretor ou use as ferramentas disponíveis):**
- Authentication → URL Configuration: Site URL `https://audita.seg.br/empresa`; Redirect URL `https://audita.seg.br/empresa/auth/confirm`.
- Authentication → Policies: **Leaked password protection** ligada (se o plano permitir; se não, registre como pendência).
- Cadastro público do Auth desativado (só o mestre cria usuários).
- Rode `scripts/backup-restauracao.mjs` (ensaio de restauração) e registre a evidência **antes** de dados reais.
- Advisors de segurança e `security_self_check()` sem alertas além dos conhecidos.

**F. Vercel (com o "pode publicar" do Diretor):**
- Projeto `audita` → Environment Variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do `audita-dev`) e `NEXT_PUBLIC_APP_ENV=producao`.
- Abra PR `develop` → `main`, faça o merge e acompanhe o deploy de produção até `READY`.
- Domínios já estão no projeto; confirme que `audita.seg.br` aponta para a produção.

**G. DNS (feito pelo Diretor, no Cloudflare):**
- No Registro.br, trocar os "Servidores DNS" do audita.seg.br pelos dois indicados pelo Cloudflare (hoje ainda são `a.auto.dns.br`/`b.auto.dns.br`).
- No Cloudflare, com **proxy desligado (nuvem cinza)**: `A` `@` → `76.76.21.21`; `CNAME` `www` → `cname.vercel-dns.com`.
- Acompanhe pela Vercel até o domínio ficar válido e o HTTPS emitido.

**H. Conferência em produção:**
- Abrir `https://audita.seg.br` (deve levar a `/empresa/login`), entrar com o mestre, **ativar a verificação em duas etapas** do mestre (decisão I3.01) com o Diretor, conferir Início, Catálogo, Biblioteca e uma cotação de conferência, e todas as telas no celular.
- Não deixe dados de teste persistentes em produção. Se precisar testar emissão, use um registro identificado e anonimizável, e combine com o Diretor.

**I. Fechamento:** registre a implantação em `docs/HISTORICO.md` (evidências, data, links), atualize `docs/PENDENCIAS_SISTEMA_REAL.md` e `docs/HOMOLOGACAO_MVP.md`, registre a decisão G1, faça o commit/push e entregue o relatório de 8 seções ao Diretor.

---

## 9. Pendências que não impedem ir ao ar

| Item | Situação |
|---|---|
| E-mail do domínio (D8) | Contratar serviço/caixa para `nao-responda@audita.seg.br`, criar os registros DNS e configurar o SMTP do Supabase. Até lá, recuperação de senha e convites usam o envio padrão do Supabase (limitado) — avise o Diretor |
| Inscrição municipal (C1.09) | Preencher nos dados institucionais quando houver (nova versão) |
| Arquivos antigos de teste no Storage | Sem registro apontando para eles; remover pelo painel (pastas listadas no fim do roteiro de limpeza) |
| SIS-001/SIS-002 | Liberados, mas o modelo de preço SaaS não existe (AUDDOC011 §6) — sem cálculo automático |
| IA na Comunicação (D-08) | Continua desligada até decisão |
| Integração PRO/HUB | Estágio próprio, futuro |
| D7 — Marketing na Biblioteca | Ficou "?" no caderno; mantido sem acesso (modo restritivo) |

---

## 10. Procedimento de migração (se precisar de alguma)

1. Arquivo `supabase/migrations/<timestamp>_<nome>.sql`, aditivo, com RLS/GRANT mínimo/`search_path = ''`.
2. `node scripts/verificar-migracoes.mjs` (PGlite) e teste de integração com `tests/helpers/pglite.ts`.
3. Aplicar com `apply_migration` no `audita-dev`, passando exatamente o conteúdo do arquivo.
4. Conferir o MD5: `select version, md5(array_to_string(statements, ';')) from supabase_migrations.schema_migrations where name = '<nome>'` = `md5sum` do arquivo.
5. Renomear o arquivo para a versão aplicada, commit, advisors e `seguranca-i9.test.ts`.

---

## 11. Testes

- `npx tsc --noEmit` · `npx eslint . --quiet` · `npx vitest run` (precisa do `.env.local`; integração usa o banco de desenvolvimento) · `npm run build` · `npx playwright test`.
- Os e2e usam o endereço com `/empresa` e viewport de celular 390×844; `tests/e2e/responsivo.spec.ts` lista as rotas que não podem ter rolagem horizontal.
- **Atenção:** os testes de integração e e2e **criam dados de teste no banco** e dependem dos usuários `@audita.test`. Depois da limpeza e da remoção desses usuários, **não rode a suíte contra o banco real** — use só o PGlite (`tests/integration/*` que usam `migratedDb`), os testes unitários e conferências manuais combinadas com o Diretor.
- Telas lentas com muitos usuários de teste acumulados (Minha conta) tiveram tempos maiores nos testes; isso some após a limpeza.

---

## 12. Preferências do Diretor

- Telas simples, seções recolhíveis, alertas em vermelho claro, gráficos fáceis.
- Quer que você faça tudo o que puder sem esperar, e diga claramente o que depende dele.
- Explicações curtas, passo a passo, com os nomes exatos dos botões. Ele pediu arquivos editáveis em Word/Excel/PowerPoint quando houver documentos.
- Relatórios em 8 seções.

---

## 13. Riscos e cuidados

- Não aplique nada no `AuditaPRO` (afetaria PRO/HUB).
- A limpeza é irreversível: execute só com a confirmação do Diretor e só o roteiro revisado.
- Não leve dados de teste à produção; não deixe CPF ou senhas em arquivos versionados.
- Mudança de texto em documento = nova versão técnica do modelo; o que já foi emitido não muda.
