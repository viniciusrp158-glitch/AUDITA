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

## I4 — Demandas / Registro Único de Atendimento

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

I4 validado pelo Diretor em 09/10/2026; ramo `develop` atualizado com o I4.

## I5 — Parâmetros financeiros e motor AUDDOC011

**Objetivo:** calcular o preço de cada item de orçamento exatamente como o simulador aprovado, sem presumir nenhum valor.
**Requisitos:** AUDDOC017 RF-09 a RF-14, CA-05, CA-06, CA-07; AUDDOC011 §§2–9 e AUDDOC011-ANX01 (abas Parâmetros e Simulador); decisões G-01, G-02 e G-07 do S0; regra do Diretor de aritmética decimal exata e margens comparadas com 4 casas.

Solução:
- **Motor** (`src/lib/pricing/engine.ts`): reproduz as células B27–B45 do simulador ANX01, inclusive "vazio ≠ zero" e a ordem das situações (PENDENTE: IDENTIFICAÇÃO → PENDENTE: CUSTOS / PARÂMETROS → REVER VALORES → REVER DESCONTO → REVER MARGEM → PRONTO PARA ANÁLISE INTERNA). Aritmética decimal exata (decimal.js, 40 dígitos); margem efetiva × alvo comparadas com 4 casas; arredondamento a centavos só na exibição. Horas em 5 campos (deslocamento técnico separado — G-02).
- **Fidelidade comprovada**: 15 cenários calculados pela própria planilha ANX01 oficial (LibreOffice) conferidos célula a célula (`tests/fixtures/anx01-simulador.json`).
- Migração `20261009224738_i5_precificacao` (MD5 `bba73fa0013cdb6627648744fd2650fb`, idêntico ao aplicado):
  - `pricing_parameter_sets`: versões numeradas pelo banco; Rascunho → Vigente → Substituída; **uma vigente**; publicação só pela função `publish_parameter_set` (a anterior vira substituída); vigente e substituída **imutáveis**; todos os valores podem ficar vazios (⇒ PENDENTE). Percentuais gravados em fração.
  - `quotes`: código `PROP-AAAA-NNNN` gerado pelo banco; **uma cotação por demanda** (AUDDOC011 §2); cliente derivado da demanda; só adota a versão vigente; demanda encerrada/não viável/cancelada não recebe cotação; situação travada em Rascunho (fluxo de emissão no I6).
  - `quote_items`: serviço do catálogo, descrição, periodicidade única/mensal (G-07), 5 campos de horas, 4 de custos diretos, contingência/margem/desconto específicos e justificativa; alteráveis apenas em rascunho.
  - RLS e trilha de auditoria em tudo (itens aparecem vinculados à cotação).
- **Telas**:
  - Configurações → Parâmetros financeiros: lista de versões; rascunho com prévia do custo/hora e da soma de percentuais (alerta se ≥ 100%), aviso de campos vazios, origem/validação; publicação com confirmação; versão publicada só para leitura.
  - Demanda → card "Orçamento": botão "Criar cotação" (o serviço da demanda entra como item 1).
  - Orçamentos: lista com pesquisa (PROP, DEM, cliente); ficha com itens, situação de cada item, motivos das pendências, totais **separados em valor único e valor mensal** (nunca somados; total só aparece quando todos os itens da periodicidade estão prontos), parâmetros usados e opção de passar para a nova versão vigente; condições (validade, pagamento, observações).
  - Item: formulário com **prévia ao vivo** de todas as etapas do cálculo; no celular, resumo fixo (situação + preço) enquanto preenche.
- Desconto acima do máximo ⇒ REVER DESCONTO; desconto exige justificativa (AUDDOC011 §6). Serviço não liberado pode ser simulado, com aviso (emissão bloqueada no I6). SaaS sem modelo (SIS-001/002) não é calculado por hora técnica e fica fora dos totais.
- Entrada em pt-BR: "8.000,00", "2.000" (milhar) e "11,2" (%); valores inválidos são recusados com mensagem.

Defeito encontrado e corrigido durante os testes: "2.000" era lido como 2 (ponto tratado como decimal). Corrigido para o padrão brasileiro (ponto = milhar) e coberto por teste unitário.

### Evidências de teste (09/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 85/85 (I5: 24 do motor — 15 cenários do ANX01 célula a célula, fórmulas §4, 5 campos de horas, CA-05 parâmetro vazio ⇒ PENDENTE sem preço, RF-12 soma ≥ 100% bloqueada, desconto no limite × acima, G-01 com 2.000 casos aleatórios, vazio ≠ zero, valores específicos, formatação BRL/% e leitura pt-BR; 8 de integração — versão e situação geradas pelo banco, limites, publicação só pela função e imutabilidade, trilha, PROP-AAAA-NNNN/uma por demanda/cliente derivado/só versão vigente, demanda encerrada, itens com trilha e cálculo a partir dos valores gravados, isolamento de anônimo e não autorizado) |
| Playwright — total | 16/16 (I5: parâmetros — prévia R$ 100,00/h e 44,19%, vazio ⇒ PENDENTE, valor inválido, confirmação obrigatória, publicação e bloqueio de edição; FL-06 — demanda → cotação → item com prévia até R$ 4.237,59 (mesmo valor do simulador) → total único, item mensal com desconto acima do máximo exige justificativa e fica REVER DESCONTO, total mensal PENDENTE e não somado, validade inválida, remoção com confirmação, vínculo na demanda e pesquisa; celular; responsividade de 21 telas em 360 px e 768 px) |
| Supabase advisors (segurança) | sem alertas novos (apenas os dois já registrados) |
| Prévia Vercel | ramo `feat/i5-precificacao` — implantação pronta |

Observações:
- No ambiente de desenvolvimento a versão vigente é a fictícia "[TESTE] Parâmetros fictícios…" (marcada TESTE). **Os parâmetros reais da AUDITA continuam pendentes** e serão cadastrados como nova versão quando o Diretor/contador os definirem; no ambiente corporativo não haverá versão alguma até lá (orçamentos ficam PENDENTE).
- O número da versão é atribuído na criação do rascunho; por isso uma versão publicada depois pode ter número menor. A lista mostra sempre a vigente primeiro.

I5 validado pelo Diretor em 09/10/2026.

## I6 — Revisões, emissão de propostas (DOCX/PDF) e decisão do cliente (em validação)

**Objetivo:** transformar a cotação calculada em proposta ao cliente — revisão congelada, emissão em Word e PDF pelos modelos aprovados, registro de aceite/recusa — sem nunca alterar o que já foi emitido.
**Requisitos:** AUDDOC017 RF-14, RF-15, RF-16, RF-17, RF-21, RF-22, RF-23, RF-24, CA-04, CA-08, CA-10; AUDDOC010 §§4–7 e anexos M01 (ANX01) e M02 (ANX02); AUDDOC011 §2.

Decisão do Diretor (09/10/2026): **para a versão de testes, considerar alguns serviços liberados**, para simular a emissão sem bloqueio; no sistema oficial, só serviços liberados geram proposta. Feito pelo fluxo normal do catálogo, com fundamento "[TESTE] Liberação fictícia, somente no ambiente de desenvolvimento…" e histórico imutável: **SST-001, SST-009, DOC-002, TRN-001 e TRN-NR06** (script `scripts/dev-liberar-servicos-teste.mjs`, que se recusa a rodar fora do projeto de desenvolvimento). A regra do sistema não foi afrouxada.

Solução:
- Migração `20261009233901_i6_revisoes_emissao` (MD5 `30b79d193aabe153b6f2ea87f4549ce6`) e correção `20261010023314_i6_corrige_reabertura` (MD5 `6e522724ff8d41ef7335167fa4daf921`; variável ambígua na reabertura, encontrada pelos testes). Ambas idênticas ao aplicado.
- **Conteúdo da proposta** na cotação: modelo (M01 proposta integrada ou M02 orçamento simplificado) e os campos customizáveis de cada modelo (objetivo, escopo incluído/excluído, local/modalidade, prazo, metodologia, entregáveis, critério de conclusão, pagamento, despesas adicionais, reagendamento/cancelamento, próximo passo). Escopo, exclusões e modalidade vêm pré-preenchidos do catálogo e são revisáveis.
- **Fluxo (RF-16):** Rascunho → **Concluir revisão (Rev.00, Rev.01…)** → Revisada → **Emitir** → Emitida → Aceita / Recusada; Cancelada a partir de qualquer etapa aberta. "Nova revisão" exige motivo e preserva a anterior (Substituída, com seus documentos). Situações só mudam pelas funções do banco.
- **Revisão congelada (RF-14, CA-08):** snapshot imutável com cliente (inclusive CNPJ e endereço), contato, demanda, conteúdo, itens, cópia integral dos parâmetros e resultados do motor. O banco confere que os resultados correspondem aos itens atuais, todos PRONTOS, com a versão de parâmetros da cotação. Antes de emitir, a aplicação recalcula a partir do snapshot e interrompe a emissão se algo divergir.
- **Pendências antes da revisão** (mostradas na tela e repetidas no banco): CNPJ/CPF do cliente, contato, parâmetros, itens com serviço do catálogo, validade e campos obrigatórios do modelo escolhido.
- **Bloqueio de emissão (RF-17, CA-04):** qualquer item com serviço não "Apto comercialmente" bloqueia a emissão, com o motivo listado.
- **Documentos (RF-15, RF-23):** DOCX e PDF gerados a partir de um único conteúdo, A4, margens 20 mm, fonte compatível com Arial (AUDDOC001), logotipo e cores do AUDDOC003; estrutura e textos fixos dos modelos M01/M02. **Nunca** contêm horas, custos, parâmetros ou margens. Totais único e mensal separados. Proponente aparece como "AUDITA — razão social e CNPJ pendentes de formalização" (não inventado). Ambiente ou dados de teste ⇒ **marca d'água "DOCUMENTO DE TESTE — SEM VALIDADE COMERCIAL" obrigatória** (verificada também no banco).
- **Modelos técnicos (RF-21):** M01 e M02 cadastrados com revisão do anexo (Rev.00), versão técnica (v1), nome e SHA-256 do arquivo oficial (conferidos com o dossiê); imutáveis. Tela Configurações → Modelos de documentos.
- **Armazenamento (RF-22, CA-10):** bucket privado `audita-documentos`; só usuários autorizados leem; sem sobrescrita, exclusão ou caminho fora do padrão. Download por link assinado de 60 s, gerado após conferência de permissão; cada download vai para a trilha (RF-24). SHA-256 de cada arquivo registrado.
- **Decisão do cliente:** aceite exige data (entre a emissão e hoje), quem aceitou e referência (e-mail, protocolo, assinatura); recusa e cancelamento exigem motivo. A demanda acompanha: emissão ⇒ "Proposta enviada"; aceite ⇒ "Aceita"; demais registros entram na linha do tempo da demanda.
- Validade: data-limite calculada na emissão; proposta vencida recebe aviso.

### Evidências de teste (10/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 99/99 (I6: 3 unitários — snapshot íntegro e adulteração detectada, M01 com todos os campos, totais separados, marca d'água e **ausência de dados internos**, M02; 11 de integração — modelos e SHA-256, pendências, congelamento e travas, imutabilidade, bloqueio por serviço não liberado, emissão com SHA-256 conferido no download, marca d'água obrigatória, emissão única, CA-10 (anônimo/não autorizado, sem sobrescrita/exclusão), **CA-08** (mudança de parâmetros não altera a revisão emitida; nova revisão usa a nova versão), aceite, recusa/cancelamento e isolamento) |
| Playwright — total | 19/19 (I6: FL-02 completo — pendências → item → conteúdo → Rev.00 → emissão → download por link assinado (PDF/DOCX) e bloqueio sem sessão → aceite → demanda "Aceita" → nova revisão Rev.01; serviço não liberado bloqueia a emissão e cancelamento exige motivo; orçamento emitido no celular; responsividade de 22 telas em 360 px e 768 px) |
| Emissão na prévia da Vercel | proposta de teste emitida no servidor da Vercel: PDF (145 KB) e DOCX (67 KB) gerados e baixados do bucket privado |
| Conferência visual | PDF e DOCX (aberto no LibreOffice) das propostas M01 e M02 conferidos página a página |
| Supabase advisors (segurança) | sem alertas novos |

Correções durante o incremento: variável ambígua na reabertura (migração aditiva); exemplo de serviço "não liberado" do teste do I3 passou a ser o TRN-NR35 (o SST-001 recebeu liberação fictícia); botão do I5 renomeado para "Salvar conteúdo".

Pendências do sistema real geradas por este incremento: ver `docs/PENDENCIAS_SISTEMA_REAL.md` (formalização e dados institucionais, liberação real dos serviços, condições comerciais padrão, revisão jurídica dos modelos, assinatura eletrônica).

