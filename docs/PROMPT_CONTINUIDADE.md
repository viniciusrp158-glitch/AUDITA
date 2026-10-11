# Prompt de continuidade — Sistema AUDITA de Operação

> **Como usar:** cole este documento inteiro como primeira mensagem para o novo Claude, junto com os anexos indicados na seção 13. Ele foi escrito em 11/10/2026 pelo Claude que desenvolveu o sistema até aqui (incrementos I1 a I10 e V1.1).

---

## 1. Seu papel e a missão

Você assume o desenvolvimento do **Sistema AUDITA de Operação**, aplicação administrativa **interna e privada** da empresa AUDITA (SSMA & SGI — Segurança, Saúde, Meio Ambiente e Sistemas de Gestão Integrados). O sistema centraliza:
- clientes;
- demandas (atendimentos);
- orçamentos e propostas;
- serviços contratados e execução;
- caixa gerencial;
- biblioteca documental;
- comunicação;
- indicadores.

O **Diretor** é Vinicius Rocha Pereira. Fale com ele em **português do Brasil**, de forma clara e sem jargão técnico desnecessário.

A missão é **finalizar o projeto**, em três frentes:
1. Aplicar as respostas do **Caderno de Pendências** (que o Diretor vai anexar respondido).
2. Fechar as decisões em aberto.
3. Levar o sistema à **produção**, somente com autorização expressa do Diretor.

Quase todo o software já está pronto e testado. O que falta é, principalmente, configurar o sistema com dados reais e fazer a implantação.

Há outros dois projetos irmãos, tocados por **outros agentes**. **Não mexa neles:**

| Agente | Repositório GitHub | Projeto Supabase | Sistema |
|---|---|---|---|
| **Você (Codex 01)** | `viniciusrp158-glitch/AUDITA` | **`audita-dev`** (ref `avfqgxckcclzktrojynj`) | Sistema AUDITA de Operação |
| Codex 02 | `AUDITAPRO` | AuditaPRO | Audita PRO |
| Codex 03 | `AUDITAHUB` | AuditaPRO | Audita HUB |

---

## 2. Regras obrigatórias (valem acima de qualquer conveniência)

As regras estão em `CLAUDE.md`, na raiz do repositório. **Leia esse arquivo primeiro.** Em resumo:

1. **Referência oficial:** AUDDOC017 Rev.00 (requisitos do sistema) e AUDDOC001–015.
   - Os documentos estão na Biblioteca do sistema (bucket `audita-biblioteca`) e na pasta `Documents\AUDITA` do Diretor.
   - Se houver divergência, valem os documentos aprovados: **apresente o conflito ao Diretor antes de decidir**.
2. **Nunca** acessar, alterar ou migrar tabelas do Audita PRO ou do Audita HUB. Tudo do AUDITA fica no schema **`audita`**. **Não fazer integração com PRO/HUB agora.**
3. Migrações:
   - apenas **aditivas**, em `supabase/migrations/`;
   - o nome do arquivo deve ser igual à versão aplicada no banco (procedimento na seção 7);
   - nada destrutivo sem aprovação expressa.
4. Segurança do banco:
   - **RLS** em toda tabela nova;
   - GRANT explícito e mínimo;
   - nada para `anon`, exceto as duas funções do autocadastro (`invite_context`, `submit_registration`);
   - funções `SECURITY DEFINER` sempre com `set search_path = ''`.
5. Sem exclusão física de cadastros, propostas e documentos: usar **inativação lógica** ou **estorno**. Revisões emitidas são imutáveis.
6. **Não inventar** dados institucionais, CNPJ, tributos, margens, valores, certificados ou qualificações. Parâmetro ausente vira **PENDENTE**, sem preço.
7. Dados fictícios:
   - só no ambiente de desenvolvimento;
   - sempre marcados como teste (`is_test`, prefixo `[TESTE]`);
   - nunca levados para a produção.
8. Cálculos financeiros:
   - fórmulas exatas do AUDDOC011;
   - aritmética decimal exata (`decimal.js`);
   - margens comparadas com 4 casas decimais.
9. Nenhuma chave privilegiada (`service_role`, chaves de IA) no navegador ou no Git.
10. Interface e testes:
    - textos em pt-BR, valores em R$ (BRL), datas dd/mm/aaaa, fuso America/Sao_Paulo;
    - identidade visual do AUDDOC003;
    - **toda tela deve funcionar em celular e computador**, conferido nos testes e2e com tela de celular.
11. Um módulo só é concluído com **testes executados** e **evidência registrada em `docs/HISTORICO.md`**.
12. Ordens permanentes do Diretor:
    - não publicar em produção sem a autorização dele;
    - não liberar comercialmente serviços que continuam condicionados no AUDDOC004;
    - não expor senhas, tokens ou chaves.
13. Forma de trabalho:
    - entregas em **incrementos pequenos**, cada um encerrado com um **relatório de 8 seções**: objetivo, requisitos do AUDDOC017, solução técnica, implementação, testes, demonstração, problemas/pendências, próximo incremento;
    - o Diretor valida cada incremento antes do próximo.

---

## 3. Arquitetura e ambiente

### Tecnologias
- **Aplicação:** Next.js 15.5 (App Router, Server Actions com `useActionState`), TypeScript, Tailwind 4 (tokens em `src/app/globals.css`, tema escuro via `html[data-theme="escuro"]`), zod 3.25, decimal.js.
- **Banco e serviços:** Supabase (Postgres 17, RLS, Storage, Edge Function `usuarios`).
- **Documentos:** `docx` e `pdfmake` (propostas e contratos); `next/og` com a fonte Montserrat embutida (peças de comunicação).
- **Testes:** Vitest (unitários e integração; `fileParallelism: false`) e Playwright (e2e, servidor em `next start` na porta 3100). O PGlite 0.5.8 executa as migrações num banco descartável.
- **Hospedagem:** Vercel, time `auditapro`, projeto `audita`. Cada branch gera um *preview*. Produção ainda **não** foi publicada.

### Repositório e branches
- Branch de trabalho: **`develop`**. Ela contém tudo até a V1.1, inclusive I10 e V1.1, que ainda aguardam validação do Diretor.
- Branches de incremento: `feat/...`. A `main` não foi usada para produção.

### Estrutura do código
- **Telas e regras:** `src/app/(app)/...`.
- **Bibliotecas:** `src/lib/` — `pricing` (motor AUDDOC011), `documents` (M01/M02 e M03–M06), `comunicacao`, `execucao`, `institutional`, `permissions`, entre outras.
- **Roteiros:** `scripts/`:
  - `verificar-migracoes.mjs`: aplica todas as migrações no PGlite;
  - `importar-dossie.mjs`: importa o acervo oficial para a Biblioteca;
  - `backup-restauracao.mjs`: ensaio de cópia de segurança e restauração;
  - `dev-liberar-servicos-teste.mjs`: liberações fictícias, só no ambiente de desenvolvimento;
  - `gerar-caderno-pendencias.cjs`: gera o Word do caderno.
- **Documentação:** `docs/`:
  - `HISTORICO.md`: evidências de cada incremento — leia;
  - `PENDENCIAS_SISTEMA_REAL.md`: lista mestra de pendências;
  - `HOMOLOGACAO_MVP.md`;
  - `ARQUITETURA.md`;
  - `Caderno_Pendencias_Sistema_AUDITA_v1.0.docx`.

### Variáveis de ambiente
O arquivo `.env.local` **não está no Git**. Os nomes estão em `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `NEXT_PUBLIC_APP_ENV` (`desenvolvimento` ou `producao`);
- usuários fictícios de teste: `TEST_ADMIN_*` (mestre de teste), `TEST_OPERADOR_*`, `TEST_MARKETING_*`, `TEST_INTRUSO_*` (sem acesso), cada um com `_EMAIL` e `_PASSWORD`.

O Diretor tem uma cópia do `.env.local` na pasta `Documents\AUDITA` do computador dele. **Não cole esses valores em mensagens nem em commits.**

### Como trabalhar
- **Ferramentas:**
  - Supabase: use as ferramentas MCP para aplicar migrações, executar SQL de verificação, consultar os *advisors* e publicar Edge Functions;
  - Vercel: use as ferramentas MCP para listar deploys e gerar link de visualização temporário (`get_access_to_vercel_url`).
- **Computador do Diretor** (ambiente usado até aqui):
  - o repositório fica em `$HOME/work/audita`, numa máquina Linux vinculada;
  - carregar o ambiente: `set -a && . ./.env.local && set +a`;
  - Playwright exigia `export LD_LIBRARY_PATH=$HOME/libs/usr/lib/x86_64-linux-gnu`;
  - rode `npx next build` antes do e2e;
  - os comandos tinham limite de ~175 s, por isso os testes rodavam em lotes;
  - esse computador **não conseguia `git push`**: o commit e o push eram feitos no ambiente de nuvem, seguidos de `git pull` no computador.
- **Seu ambiente pode ser diferente:** adapte. O essencial é ter Node 22, as dependências do `package.json`, o `.env.local` e o Chromium do Playwright.
- **Cópia para o Diretor:** depois de cada incremento, sincronize os arquivos versionados com a pasta dele: `git ls-files | grep -v '^\.env' > /tmp/fl && rsync -a --files-from=/tmp/fl . "<Documents>/AUDITA/"`.

---

## 4. Modelo de segurança atual (não afrouxe sem decisão do Diretor)

### Níveis de acesso
Ficam em `audita.app_users.role`, com as funções `is_admin()`, `has_role(...)`, `can_operate()`, `can_communicate()` e `is_master()`.

- **Administrador:** acesso completo.
- **Usuário mestre:**
  - **titular:** o Diretor (`is_master`);
  - **mestres adicionais:** `is_comaster`, com as mesmas permissões do titular;
  - só um mestre cria usuários e define níveis (Minha conta → Gerenciamento de usuários, via Edge Function `usuarios`);
  - ninguém altera o próprio nível;
  - o titular não pode ser alterado por outro mestre.
- **Operador administrativo** (modo **mais restritivo**, decisão do Diretor):
  - faz: clientes, unidades, contatos, demandas e preparo de orçamentos **sem ver preços**;
  - não vê: parâmetros, revisões, documentos emitidos, autocadastro, biblioteca, comunicação, serviços contratados nem caixa;
  - políticas RESTRITIVAS no banco e o gatilho `pricing_admin_guard` garantem isso.
- **Marketing:** só o módulo Comunicação e a própria conta. Escreve e envia peças para revisão; não aprova; vê só os logos aprovados.

### Outras proteções
- Arquivos em buckets privados (`audita-documentos`, `audita-biblioteca`, `audita-marca`), com links assinados de curta duração.
- `security_self_check()` faz a autoverificação. Os testes `tests/integration/seguranca-i9.test.ts` varrem tabelas, funções e Storage.
- **Matriz D7 do caderno:** cada "?" respondido libera uma permissão. Cada liberação exige uma nova migração **aditiva** (por exemplo, remover uma política restritiva específica criando outra mais ampla, ou ajustar a função de nível), com teste de integração e e2e.
- Aproveite a mesma migração para consolidar as políticas permissivas duplicadas (aviso de desempenho do Supabase).

---

## 5. O que já está pronto

O detalhe e as evidências de cada incremento estão em `docs/HISTORICO.md`.

| Inc. | Entrega | Situação |
|---|---|---|
| I1 | Fundação: login, sessão, lista de autorizados, trilha de auditoria, menu com 7 entradas | Validado |
| I2 / I2.1 | Clientes, unidades, contatos (código CLI permanente, duplicidade, inativação); autocadastro por link individual com termo LGPD | Validado |
| I3 | Catálogo AUDDOC004/005 (33 serviços + 12 ofertas), situação de liberação com histórico | Validado |
| I4 | Demandas (RUA, estados do AUDDOC009, linha do tempo) | Validado |
| I5 | Parâmetros versionados + motor AUDDOC011 (reproduz a planilha ANX01), cotação com vários itens, único × mensal | Validado |
| I6 | Revisões congeladas, emissão M01/M02 em DOCX e PDF com marca d'água de teste, aceite/recusa, desconto autorizado, tempo de contrato | Validado |
| I7 | Biblioteca documental (acervo oficial importado com SHA-256, revisões vigente/substituída) | Validado |
| I8 | Indicadores com gráficos e alertas (conversão, ticket médio, cotado × aceito) | Validado |
| I9 | Homologação do MVP: CA-01 a CA-12, varredura de segurança, ensaio de cópia e restauração | Validado |
| I9.1 | Minha conta (seções recolhíveis), tema claro/escuro, níveis de acesso, usuário mestre adicional | Validado |
| I9.2 | Dados institucionais em versões (rascunho → vigente), ligados ao campo "Empresa proponente" e ao rodapé das propostas | Entregue; o Diretor elogiou e pediu para seguir; tratar como validado |
| **I10** | Comunicação **sem IA**: biblioteca de marca (logos oficiais da AUDITA, do PRO e do HUB **já aprovados**), campanhas, 5 modelos de peça (PNG/PDF), revisão de marca e texto com checklist, exportação registrada | **Aguardando validação** |
| **V1.1** | Serviço contratado e execução (CTR), OS comercial M05 (OS-COM), alteração de escopo M06 (ALT), minutas M03/M04, caixa gerencial e indicadores de caixa no Início | **Aguardando validação** |

### Regressão na entrega
- Vitest **162/162**.
- Playwright **40/40**.
- `tsc`, `eslint` e `next build` sem erros.
- *Advisors* de segurança do Supabase: só "proteção contra senhas vazadas" (pendência 17, configuração do painel).

**Primeira tarefa sugerida:** apresente ao Diretor o relatório do I10 e da V1.1 (estão no `HISTORICO.md`), com um link de visualização da Vercel da branch `develop`, e peça a validação.

---

## 6. O que falta (lista completa)

A fonte é `docs/PENDENCIAS_SISTEMA_REAL.md`, organizada por etapas. O **Caderno de Pendências** (Word) traz cada item com o AUDDOC correspondente e os campos que o Diretor, o jurídico (J) e a contabilidade (C) preenchem.

### 6.1 Aplicar as respostas do caderno

| Caderno | Assunto | Onde aplicar no sistema | Como |
|---|---|---|---|
| **C1, D6** | Formalização da empresa e dados institucionais (razão social, CNPJ, CNAEs, inscrições, regime, endereço, e-mail/telefone/site oficiais, responsável técnico, signatário) | Configurações → Dados institucionais | Criar versão, preencher, publicar. Os campos já existem e são validados (CNPJ com dígito verificador). Os documentos passam a sair sem PENDENTE |
| **C2–C5, D1** | Tributos, pró-labore, despesas fixas, taxas, comissão, contingência, margem-alvo, desconto máximo, horas faturáveis | Configurações → Parâmetros financeiros | Nova versão com os valores reais e a fonte/validador; publicar. **Em produção** não levar o conjunto "[TESTE]" |
| **D2** | Política de desconto por família | Hoje: desconto até o máximo do parâmetro, com autorização registrada no item | Se o Diretor definir limites por família, implementar a regra no motor e no banco (migração aditiva + testes do motor) |
| **D3, D4** | Liberação de cada serviço/treinamento (AUDDOC004) e comprovações do responsável técnico | Configurações → Catálogo de serviços | Registrar a decisão de cada serviço pelo fluxo normal (fundamento e verificação documentos/RT/recursos). Só "Apto comercialmente" gera proposta final. **Não liberar** o que continuar condicionado |
| **D5** | Condições comerciais padrão (pagamento, despesas, reagendamento, validade) | Conteúdo da proposta | Se padronizar, criar valores padrão por modelo (preenchimento inicial editável) |
| **D7** | Matriz de permissões por nível | Políticas do banco e `src/lib/permissions.ts` | Seção 4 acima. Migração aditiva + testes `niveis-i9-1` e e2e |
| **D8** | Remetente dos e-mails (domínio próprio) | Supabase Auth (SMTP), recuperação de senha, avisos do autocadastro | Configurar o SMTP no painel. Depois, liberar a troca de e-mail em Minha conta |
| **D9** | Metas dos indicadores | Início | Exibir meta × realizado (configuração simples, versionada, só administrador) |
| **D10** | Arquivo aprovado do AUDDOC001; títulos internos do AUDDOC014/015 | Biblioteca | Enviar nova revisão e publicar |
| **D11** | Escopo do piloto e gates G1/G2 (AUDDOC015) | Decisão | Registrar no histórico e seguir a decisão |
| **C6** | Emissão fiscal, cobrança e recebimentos | Fora do sistema (RF-18: o caixa não substitui a contabilidade) | Registrar a decisão; no máximo, campos de referência de NF no caixa (já existe "Comprovante / referência") |
| **J1, J2** | Revisão jurídica de M01/M02 e de M03–M06 | Modelos de documentos (`src/lib/documents/proposal.ts` e `contracts.ts`) | Aplicar o texto revisado. Registrar nova **versão técnica** do modelo (Configurações → Modelos) e, se o documento mudar, nova revisão na Biblioteca. Para M03–M06: retirar a marca "MINUTA — PENDENTE DE REVISÃO JURÍDICA" (`LEGAL_WATERMARK`) só depois da aprovação e preencher as cláusulas 11 e 12 do M04 |
| **J3** | LGPD (termo do autocadastro, aviso de privacidade, papéis) | Autocadastro (`consent_terms` versionado) | Publicar a nova versão do termo |
| **J4** | Prazos de retenção e descarte | Hoje nada é excluído | Implementar só o que for decidido, com registro da decisão (anonimização ou descarte controlado, testado) |
| **J5** | Aceite por e-mail e assinatura eletrônica | Registro de aceite da proposta | Se houver fornecedor, integrar depois de aprovado; senão, manter o registro atual (data, nome, referência) |
| **J6** | Marca em relatórios e limites de responsabilidade técnica | Textos dos modelos e das peças | Ajustar textos conforme a decisão |

### 6.2 Decisões que não estão no caderno
- **D-08 — IA na Comunicação:** aprovar fornecedor, custo, tratamento de dados e quem revisa. Até lá, a Comunicação fica **sem IA**.
  - Se for aprovada, a chave fica só no servidor (Edge Function ou variável de servidor).
  - A IA gera apenas um **rascunho**, que passa pela mesma revisão já existente (RF-26/RF-28).
  - Nada é publicado automaticamente.
- **Fotos nas peças de comunicação:** dependem de regra de direito de imagem e LGPD (jurídico).
- **Logos:** os PNGs foram enviados pelo chat (podem ter sido convertidos no caminho). Na implantação, peça os **arquivos-matriz originais** e reenvie-os na Biblioteca de marca; o sistema avisa quando o arquivo é idêntico.

### 6.3 Ida para produção (itens 15 e 17–22 de `PENDENCIAS_SISTEMA_REAL.md`)
**Somente com autorização expressa do Diretor.**

1. **Banco de produção.** O AUDDOC017 §12 prevê um banco corporativo compartilhado com o PRO/HUB. Confirme com o Diretor qual projeto usar e então:
   1. faça o inventário de schemas e tabelas e confirme o backup;
   2. monte o plano de reversão;
   3. aplique as **22 migrações** do repositório **somente no schema `audita`**, na ordem;
   4. ao expor o schema na API, **acrescente** `audita` à lista existente, **sem retirar** os schemas do PRO (achado H-04);
   5. publique a Edge Function `usuarios`.
2. **Segurança das contas.** Ative a verificação em duas etapas (MFA) do administrador e a proteção contra senhas vazadas. Deixe o cadastro público do Auth **desativado**.
3. **E-mail.** Configure o SMTP com domínio próprio (D8).
4. **Vercel.** Ambiente de produção com `NEXT_PUBLIC_APP_ENV=producao` e as variáveis do banco de produção; subdomínio de audita.seg.br.
5. **Carga inicial real:**
   - usuário do Diretor (`is_master`);
   - dados institucionais, parâmetros e liberações publicados;
   - acervo oficial com `scripts/importar-dossie.mjs`;
   - logos oficiais na Biblioteca de marca;
   - **nenhum dado de teste**: as migrações não carregam dados.
6. **Backup.** Configure a rotina do plano Supabase e faça um **novo ensaio de restauração** (`scripts/backup-restauracao.mjs`) antes de cadastrar dados reais.
7. **Regressão final em produção.** Sem deixar dados de teste persistentes; conferir as telas no celular.
8. **Entrega final ao Diretor.** Relatório final e atualização de `HOMOLOGACAO_MVP.md` e `PENDENCIAS_SISTEMA_REAL.md`.

### 6.4 Fora de escopo agora
Integração com Audita PRO/HUB (AUDDOC014; AUDDOC017 §12), que terá um estágio próprio. Também ficam fora, por definição do AUDDOC017 §2: auditorias ISO, EPI, CIPA, brigada, EAD, laudos, ART, faturamento fiscal e gateway de pagamento.

---

## 7. Procedimento de migração (siga exatamente)

1. Escreva o arquivo `supabase/migrations/<timestamp>_<nome>.sql`: somente aditivo, com RLS, GRANT mínimo e `SECURITY DEFINER` com `search_path = ''`.
2. Teste no banco descartável: `node scripts/verificar-migracoes.mjs "select 1"` (aplica todas as migrações no PGlite). Escreva também um teste de integração em `tests/integration/` usando `tests/helpers/pglite.ts` (`migratedDb`, `asUser`) para os fluxos que mudariam o estado do banco real.
3. Aplique com a ferramenta MCP `apply_migration` (projeto do ambiente certo, nome `<nome>`), passando **exatamente** o conteúdo do arquivo.
4. Confira o MD5: `select version, md5(array_to_string(statements, ';')) from supabase_migrations.schema_migrations where name = '<nome>'`. O resultado deve ser igual ao `md5sum` do arquivo.
5. Renomeie o arquivo para `<version retornada>_<nome>.sql` e faça o commit.
6. Rode os *advisors* de segurança e o `seguranca-i9.test.ts`. Se a migração criar bucket, acrescente-o à lista esperada nesse teste.

---

## 8. Testes e evidências

- **Comandos:**
  - `npx tsc --noEmit`
  - `npx eslint src tests --quiet`
  - `npx vitest run` (precisa do `.env.local`; os testes de integração usam o banco de desenvolvimento e os usuários fictícios)
  - `npx next build`
  - `npx playwright test` (em lotes, se houver limite de tempo)
- **Viewport de celular:** os testes e2e de cada módulo usam 390×844. O `tests/e2e/responsivo.spec.ts` lista as rotas que não podem ter rolagem horizontal; **inclua nele toda rota nova**.
- **Falhas intermitentes conhecidas:** login com tempo de 5 s esgotado no e2e do I6. Repita o teste antes de investigar.
- **Registro:** em cada entrega, registre em `docs/HISTORICO.md`:
  - objetivo e requisitos;
  - solução (com a migração e o MD5);
  - tabela de evidências (contagens de testes);
  - dados de teste deixados no ambiente de desenvolvimento.
- Mantenha atualizados `docs/PENDENCIAS_SISTEMA_REAL.md` e, no Projeto do claude.ai "Sistema AUDITA de Operação", os docs `claude/PENDENCIAS_SISTEMA_REAL.md` e `claude/HOMOLOGACAO_MVP.md`.

---

## 9. Dados de teste existentes no desenvolvimento (não levar à produção)

- Parâmetros "[TESTE] Parâmetros fictícios…".
- Liberação fictícia de SST-001, SST-009, DOC-002, TRN-001 e TRN-NR06 (decisão do Diretor de 09/10/2026, só no ambiente de desenvolvimento).
- Clientes, demandas, propostas, serviços contratados (CTR), OS, alterações, lançamentos de caixa e peças de comunicação marcados TESTE.
- Rascunho institucional vazio "versão 1" (TESTE).
- Logos oficiais aprovados (marcados como teste no ambiente de desenvolvimento) e o ativo "[TESTE] Logo AUDITA (arquivo do sistema)", inativado.

---

## 10. Preferências do Diretor (aprendidas no projeto)

- Quer telas simples:
  - seções recolhíveis em vez de muita informação aberta;
  - alertas em vermelho claro;
  - indicadores com gráficos fáceis de entender.
- Valida cada incremento e às vezes pede ajustes visuais. Atenda aos ajustes e registre-os no `HISTORICO.md` como "Ajustes do Ix pedidos na validação".
- Prefere que você termine tudo o que for possível sem esperar respostas, e que deixe claro o que depende dele, do jurídico ou da contabilidade.
- Relatórios: 8 seções, objetivos, com link de visualização da Vercel (expira em ~23 h) e capturas de tela salvas em `Documents\AUDITA\_telas_*`.

---

## 11. Primeiros passos recomendados (nesta ordem)

1. Leia `CLAUDE.md`, este documento, `docs/HISTORICO.md` (pelo menos I9 em diante) e `docs/PENDENCIAS_SISTEMA_REAL.md`.
2. Prepare o ambiente: `npm ci`, `.env.local` e Chromium do Playwright. Rode `tsc`, `eslint`, `vitest` e um lote de e2e para confirmar que está tudo verde.
3. Envie ao Diretor um link de visualização da `develop` e peça a validação do **I10** e da **V1.1**. Aplique os ajustes que ele pedir.
4. Leia o **Caderno de Pendências respondido**. Monte um plano em incrementos e apresente-o antes de executar. Sugestão:
   1. **F1:** dados institucionais, parâmetros, liberações e condições padrão (configuração pelas telas, sem código, com evidências);
   2. **F2:** matriz D7 de permissões (migração + testes);
   3. **F3:** textos jurídicos revisados em M01–M06 e no termo LGPD (novas versões técnicas; retirada da marca de minuta só do que foi aprovado);
   4. **F4:** metas dos indicadores, e-mail e demais ajustes;
   5. **F5:** ida para produção (seção 6.3), só com autorização.
5. Para cada item do caderno ainda "a definir" ou ambíguo, **pergunte ao Diretor antes**. Não suponha valores.

---

## 12. Riscos e cuidados

- O banco de produção pode ser **compartilhado com o PRO**. Qualquer DDL fora do schema `audita`, ou mudança em `pgrst.db_schemas` que remova schemas existentes, pode derrubar o PRO.
- **Não reutilize** dados de teste em produção. Os indicadores excluem `is_test` em produção, mas a carga inicial deve ser limpa.
- Os documentos emitidos e as revisões são **imutáveis** por gatilho. Mudança de texto = nova versão técnica do modelo, sem alterar o que já foi emitido.
- Em uma proposta, só serviço "Apto comercialmente" sai como documento final. Na Comunicação, a aprovação é bloqueada para peças que citem serviço não liberado.

---

## 13. Anexos que o Diretor deve enviar junto com este prompt

1. **Este arquivo** (`PROMPT_CONTINUIDADE.md`). Também está no repositório, em `docs/`.
2. **Caderno de Pendências respondido** (`Caderno_Pendencias_Sistema_AUDITA_v1.0.docx` preenchido pelo Diretor, jurídico e contabilidade).
3. **Acesso, em vez de anexo:**
   - repositório GitHub `viniciusrp158-glitch/AUDITA`;
   - projeto Supabase `audita-dev` (e, na implantação, o de produção);
   - time Vercel `auditapro`.

   Conecte esses serviços na sessão do novo Claude.
4. **Variáveis de ambiente** (`.env.local`, que está em `Documents\AUDITA`): forneça-as por um canal seguro ou deixe o novo Claude ler da pasta. Não cole os valores no chat.
5. *(Na implantação)* Arquivos-matriz originais dos logos e qualquer documento novo aprovado (por exemplo, a revisão aprovada do AUDDOC001).

Tudo o mais — código, migrações, testes, documentação, histórico e o próprio caderno em branco — está no repositório e na pasta `Documents\AUDITA`.
