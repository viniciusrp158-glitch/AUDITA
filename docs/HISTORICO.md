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
| — | Todas as telas devem funcionar em celular e computador (verificação automática de rolagem horizontal em 360 px e 768 px). |
| — | Ficha cadastral em Word (AUDFOR001) descartada; o cadastro pelo cliente é feito pelo link do I2.1. |
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

## I2 — Clientes, unidades e contatos (validado pelo Diretor em 09/10/2026)

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

## Documento — Ficha Cadastral de Cliente (descartada)

Minuta v0.1 em Word elaborada em 09/10/2026 e **descartada pelo Diretor** no mesmo dia, substituída pelo autocadastro por link (I2.1). O código AUDFOR001 chegou a ser proposto, mas nunca foi aprovado nem emitido; arquivos removidos do repositório.

## I2.1 — Autocadastro do cliente por link individual (validado pelo Diretor em 09/10/2026)

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

## I3 — Catálogo de serviços e situação de liberação (em validação)

**Objetivo:** catálogo interno a partir da AUDDOC004/005, com a situação comercial de cada serviço e o registro das decisões de liberação.
**Requisitos:** AUDDOC017 RF-05, RF-17, CA-04; AUDDOC004 Rev.00 (matriz e treinamentos por NR); AUDDOC005 §§3, 13, 14; AUDDOC011 §6 (unidade de cobrança e SaaS).

Solução:
- Migração `20261009192650_i3_catalogo_servicos`: `services` (33 serviços + 12 ofertas de treinamento vinculadas ao TRN-005, com escopo, limites, requisitos, referências, classe A/B/C, verificação documentos/RT/recursos e observações) e `service_status_history`.
- Situações conforme AUDDOC005 §14: Não liberado, Apto tecnicamente, Apto comercialmente, Expansão futura. **Todos iniciam "Não liberado"** (AUDDOC004 Rev.00); nenhuma liberação foi feita pela carga.
- Mudança de situação exige fundamento (mín. 10 caracteres) e gera histórico imutável (de/para, fundamento, referência, data, responsável). Fundamento não pode ser reescrito sem nova decisão. Código, tipo e vínculo são permanentes; sem inclusão/exclusão pela API.
- `service_allows_commercial_proposal`: só "Apto comercialmente" e ativo no catálogo permitem proposta comercial final (será usada no I6). Serviço inativo não pode ser liberado.
- SIS-001 (HUB) e SIS-002 (PRO) marcados "sem modelo definido": não usam a hora técnica automaticamente (AUDDOC011 §6).
- Telas em Configurações → Catálogo de serviços: contadores por situação, pesquisa (código, nome, norma), filtros por família e situação; tabela no computador e cartões no celular; ficha com escopo, requisitos, ofertas, verificação operacional, decisão e histórico.

Recuperação (09/10/2026): o código das telas do I3 foi escrito numa sessão cujo ambiente temporário foi encerrado antes do envio ao GitHub; só a migração estava aplicada no banco. O arquivo da migração foi reconstruído a partir do banco e conferido byte a byte (MD5 `385d84dfce4b23e95ed2e0b8bfaceb4a`, idêntico ao aplicado); as telas foram reconstruídas a partir das capturas daquela sessão. Para evitar repetição, todo trabalho passa a ser enviado ao GitHub antes dos testes.

### Evidências de teste (09/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 43/43 (I3: 8 novos — 33+12 itens e vínculo ao TRN-005; carga inicial toda "Não liberado"; SaaS sem hora técnica; CA-04; fundamento obrigatório; histórico imutável; inativo não libera; código permanente e sem inclusão/exclusão; isolamento de anônimo e não autorizado) |
| Playwright — total | 11/11 (I3: lista, pesquisa por norma, filtro por família, ficha, decisão com fundamento e reversão, verificação operacional; catálogo e ficha no celular; **responsividade: 14 telas sem rolagem horizontal em 360 px e 768 px**) |

Observação: os testes registram decisões fictícias em ESP-006/ESP-007 no ambiente de desenvolvimento e as revertem ao final; ficam visíveis no histórico desses serviços.

I3 validado pelo Diretor em 09/10/2026.

## I4 — Demandas / Registro Único de Atendimento (em validação)

**Objetivo:** registrar as solicitações dos clientes numa única tela e acompanhá-las até o encerramento, sem burocracia.
**Requisitos:** AUDDOC017 RF-06, FL-05, RF-08; AUDDOC009 §8 (RUA) e §8.1 (estados); AUDDOC013 (código não reutilizável).

Solução:
- Migração `20261009215329_i4_demandas`: `demands` (código `DEM-AAAA-NNNN` gerado pelo banco, permanente; cliente, unidade, contato e serviço do catálogo; origem, resumo, escopo, local, recebimento, prazo; contrato recorrente; viabilidade AUDDOC004; observações) e `demand_events` (linha do tempo somente inclusão: anotação, contato, visita e mudança de situação).
- Situações do AUDDOC009 §8.1 (decisão G-04): Recebida, Em análise, Aguardando cliente, Proposta enviada, Aceita, Em execução, Entregue, Encerrada, Não viável, Cancelada. **Transições livres** (etapas podem ser puladas); reabertura permitida; cancelar e "não viável" exigem motivo. A situação só muda pela função `change_demand_status`, que registra o evento.
- Contrato recorrente: visitas e contatos ficam na mesma demanda, sem novo cadastro por visita (AUDDOC009).
- Vínculos coerentes: unidade e contato devem ser do mesmo cliente; cliente inativo não recebe nova demanda; prazo não anterior ao recebimento; sem exclusão física.
- Serviço não liberado pode ser registrado e analisado, com aviso de que não gera proposta comercial final (RF-17).
- Telas: Demandas (Em aberto / Encerradas / Todas, pesquisa por código, resumo e cliente, filtro por situação, aviso de prazo vencido; tabela no computador e cartões no celular), Nova demanda (pode partir da ficha do cliente), ficha da demanda (situação, acompanhamentos, linha do tempo), edição; aba "Demandas e propostas" no cliente.
- As alterações das demandas também aparecem no histórico do cliente.

Observação: os campos de data usam o seletor nativo do navegador, que exibe o formato do idioma do aparelho (dd/mm/aaaa em navegadores em português); todas as datas exibidas pelo sistema seguem dd/mm/aaaa.

### Evidências de teste (09/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 53/53 (I4: 8 novos — código gerado/sequencial e ignorando valores enviados; código permanente e sem exclusão; situação só pela função; transições livres, encerramento e reabertura com eventos; motivo obrigatório; recorrente com visitas/contatos e linha do tempo imutável; vínculos coerentes e cliente inativo; prazo; histórico do cliente e isolamento) |
| Playwright — total | 13/13 (I4: fluxo FL-05 completo a partir da ficha do cliente — cadastro com unidade/contato/serviço não liberado, visita, análise, motivo obrigatório, encerramento, filtros e pesquisa por cliente; demandas no celular; responsividade de 17 telas em 360 px e 768 px) |
