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

## Fluxo de branches e publicação

- `feat/*`: desenvolvimento de cada incremento.
- `develop`: integração dos incrementos validados; preview estável na Vercel (protegido por login Vercel).
- `main`: **produção — só recebe merge com autorização expressa do Diretor.** Sem variáveis de ambiente de produção configuradas, qualquer build de produção falha por segurança.

## I1 — Fundação (validado pelo Diretor em 09/10/2026)

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

Atualizações pós-validação: link "Alterar senha" no menu; usuário administrador do Diretor criado no `audita-dev` (senha provisória a ser trocada); Vercel conectada (preview `develop`); cadastro público desativado no Supabase (verificado via `/auth/v1/settings`: `disable_signup: true`).

## I2 — Clientes, unidades e contatos (em validação)

**Objetivo:** cadastro mestre de clientes com código permanente, unidades, contatos, pesquisa, duplicidade, inativação e histórico.
**Requisitos:** AUDDOC017 RF-02, RF-03, RF-04, RF-08, FL-01, CA-02, CA-03, CA-10 (dados); AUDDOC013 §§3–5.

Solução:
- Migração `20261009173351_i2_clientes`: `clients`, `client_units`, `client_contacts`, `code_counters`; validação de CNPJ/CPF no banco; código `CLI-NNNN` gerado por gatilho (valor enviado é ignorado), imutável e nunca reutilizado; sem DELETE; inativação exige motivo; unicidade de documento; nome de unidade único por cliente; um contato principal ativo por cliente; contato só pode apontar unidade do mesmo cliente.
- Duplicidade plausível (`find_similar_clients`): mesmo documento (bloqueia) ou nome semelhante por trigramas sem acentos (exige confirmação explícita).
- Histórico por cliente: a trilha passou a registrar `parent_entity_id`, reunindo alterações do cliente, unidades e contatos.
- Extensões `pg_trgm` e `unaccent` instaladas no schema `extensions` (em produção compartilhada: aditivo, avaliar no plano de migração).
- Decisão técnica: o S0 previa schema `core` para dados mestres; mantido tudo em `audita` conforme a decisão de estrutura totalmente separada (D-02). Na futura integração, o cadastro mestre poderá ser exposto por visão/serviço sem mover dados.

### Evidências de teste (09/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc --noEmit`, `eslint`, `next build` | sem erros |
| Vitest — unitários (documentos BR, formatação, histórico legível) | 7/7 |
| Vitest — integração I1 (acesso/RLS) | 7/7 |
| Vitest — integração I2 (código gerado/imutável/não reciclado, inativação, CNPJ inválido/duplicado, duplicidade plausível, 2 unidades + contatos, vínculo unidade×cliente, histórico, isolamento de usuário não autorizado) | 10/10 |
| Playwright — I1 (5) + FL-01 completo de cliente (cadastro, validação, unidade, contato, pesquisa por código/CNPJ/nome sem acento, duplicidade, edição, inativação, histórico, filtro de inativos) | 6/6 |

I2 validado pelo Diretor em 09/10/2026.

## Documento — AUDFOR001 Ficha Cadastral de Cliente (minuta v0.1)

Formulário Word para o cliente preencher, com os mesmos campos do cadastro, no padrão AUDDOC001/AUDDOC003. Primeiro código da família FOR; aguarda aprovação para Rev.00. Arquivos em `docs/modelos/` (inclui o gerador).

## I2.1 — Autocadastro do cliente por link individual (em validação)

**Objetivo:** o cliente preenche os próprios dados por um link enviado pelo Diretor; os dados chegam ao banco como solicitação pendente e só viram cadastro após aprovação.
**Decisões do Diretor:** link individual por cliente; uso único; validade de 24 h; acompanhamento enviado/preenchido/expirado; botão genérico de compartilhar; termo recolhido com opção de expandir + caixa de aceite.
**Requisitos:** AUDDOC017 RF-02/03/04, §10; AUDDOC006 (formulário público: validação no servidor, limitação de abuso, armazenamento controlado, privacidade); AUDDOC015 G0 (somente dados fictícios até produção).

Solução:
- Migração `20261009184208_i2_1_autocadastro`: `client_invites` (somente hash SHA-256 do token; validade máxima de 24 h imposta pelo banco; uso registrado apenas pelo envio; cancelamento), `client_registration_requests` (envio preservado como recebido; aprovação/recusa com motivo), `consent_terms` (termo versionado e imutável, `TERMO-CAD-v0.1`).
- Área pública: o papel anônimo não lê nenhuma tabela; só executa `invite_context` (situação do link + termo, sem revelar destinatário) e `submit_registration` (valida link, aceite da versão vigente, CNPJ/CPF, contatos e limites).
- Aprovação (`approve_registration`): cria cliente (código CLI), unidades e contatos numa transação; administrador pode corrigir dados antes; verificação de duplicidade reaproveitada do I2.
- Telas: Clientes → "Link de cadastro" (gerar, compartilhar/copiar, situação, cancelar) e "Solicitações" (pendentes/aprovadas/recusadas, análise, aprovação, recusa); contador de pendentes no menu; página pública `/cadastro/[token]` otimizada para celular, com campo-armadilha antirrobô.
- Correção encontrada pelos testes: listas de seleção (ex.: UF) voltavam à opção inicial após erro de validação (comportamento do React 19); corrigido no componente compartilhado, com teste de regressão.

### Evidências de teste (09/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 35/35 (I2.1: 11 novos — validade 24 h, área pública fechada, termo vigente, CNPJ inválido, uso único, expirado/cancelado, uso não forjável, aprovação com unidades/contatos vinculados, envio imutável, recusa com motivo, isolamento de não autorizados) |
| Playwright — total | 7/7 (I2.1: gerar link → preencher no celular sem login → bloqueio sem aceite → termo expansível → envio → link já utilizado → "Preenchido" → análise → aprovação → cliente com unidade e contato) |
| Supabase advisors (segurança) | sem alertas novos (apenas avisos já registrados) |

Pendências para uso real: produção (G1), subdomínio do audita.seg.br (a página pública não pode ficar atrás da proteção de login da Vercel), revisão jurídica do termo, aviso por e-mail de novas solicitações (requer provedor de e-mail).

Observação: os testes automatizados criam clientes fictícios "[Teste automatizado] …" (marcados TESTE) no ambiente de desenvolvimento; por regra, não há exclusão física.
