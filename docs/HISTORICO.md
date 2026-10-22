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

## I6 — Revisões, emissão de propostas (DOCX/PDF) e decisão do cliente

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

### Ajustes do I6 pedidos na validação (10/10/2026)

O Diretor validou o I6 e pediu três ajustes:

1. **Desconto sempre bloqueava.** Conferido na fórmula oficial do ANX01 (célula B45): o preço sugerido já dá exatamente a margem-alvo, então **qualquer** desconto deixa a margem efetiva abaixo da meta (REVER MARGEM), e a margem específica não resolve, porque passa a ser a própria meta. O AUDDOC011 §4.6 diz que descontos "exigem nova verificação" e o §5 que o preço após desconto é "valor a ser autorizado". **Decisão do Diretor:** desconto até o máximo dos parâmetros segue com **autorização expressa registrada** no item (justificativa, responsável e data, gravados também no snapshot da revisão); a situação continua "REVER MARGEM", fiel à planilha, com o selo "Desconto autorizado"; acima do máximo continua bloqueado. Migração `20261010040656_i6_desconto_autorizado` (MD5 `de4f9a2aa9a777061b3a4db35bb14d26`). Fórmulas do motor inalteradas.
2. **Cabeçalho "CAMPO / PREENCHIMENTO" repetido no PDF** quando a tabela começava no fim da página. Corrigido no PDF e no Word: o cabeçalho de tabela nunca fica sozinho no fim da página.
3. **Tempo de contrato para serviços mensais.** Novos campos "Início previsto do contrato" e "Tempo de contrato (meses)", exigidos quando há item mensal. A proposta mostra a vigência ("12 meses — de 01/11/2026 a 31/10/2027") e, por decisão do Diretor, o **valor total do contrato** (mensal × meses), sem somar com valores únicos. Migração `20261010034458_i6_tempo_contrato` (MD5 `4ded046391d6053e8561edfa7d14df67`).

Testes acrescentados: 7 unitários (desconto autorizado e regras de bloqueio; data final do contrato, inclusive meses curtos e ano bissexto; conteúdo do documento com vigência e valor total) e 2 de integração (autorização exigida, justificativa obrigatória, bloqueio acima do máximo mesmo com resultado forjado, contrato obrigatório para item mensal e gravado no snapshot). Compilação na Vercel concluída. Testes executados em 10/10/2026 (com o I7): todos aprovados, inclusive o e2e "item mensal com desconto autorizado e tempo de contrato até a emissão"; PDF mensal conferido visualmente (cabeçalho da tabela não se repete; vigência e valor total do contrato corretos).

## I7 — Biblioteca documental (validado pelo Diretor em 10/10/2026)

**Objetivo:** guardar os documentos oficiais da AUDITA com código, revisão, aprovação e SHA-256, sem nunca sobrescrever versões, com acesso privado e download rastreado.
**Requisitos:** AUDDOC017 RF-19, RF-20, RF-21, RF-22, RF-24, FL-03, CA-09, CA-10, §18 (minutas nunca vigentes); AUDDOC001; AUDDOC013.

Solução:
- Migração `20261010041535_i7_biblioteca` (MD5 `5b41e4aa2dd5f5b42cd1c4ad16f980d5`): documentos (código AUDDOC/ANX permanente, título, família, fase, visibilidade, anexo vinculado ao principal) e revisões (Rev.NN com arquivo próprio no bucket privado `audita-biblioteca`, SHA-256, aprovação). Rascunho → **Vigente** só com aprovador e data registrados; a vigente anterior vira **Substituída** e continua acessível (CA-09); rascunho pode ser cancelado com motivo; nada é excluído; arquivo de uma revisão nunca muda.
- Envio pela tela: o arquivo vai do navegador direto ao bucket privado por **link de envio assinado** (o servidor define o caminho; nenhuma chave no navegador); o servidor baixa o arquivo, **calcula ele mesmo o SHA-256** e só então registra. Download por link assinado de 60 s, registrado na trilha.
- Tela do documento mostra quando o arquivo vigente é a base de um modelo técnico do sistema (mesmo SHA-256 — RF-21).
- **Acervo oficial:** manifesto dos 25 arquivos (AUDDOC001–015, anexos e AUDDOC017) conferido com os índices LEIA-ME do dossiê: 23 idênticos byte a byte; AUDDOC017 sem índice (aprovação própria). Roteiro `scripts/importar-dossie.mjs` confere tudo antes de enviar e é reexecutável.
- **Achados da conferência (levados ao Diretor):**
  - **AUDDOC001:** o arquivo do dossiê (nome antigo AUDPRO001) é a **minuta** — declara "Status: Rascunho", data e responsável "[Inserir…]" e tem tamanho diferente do índice. Importado como **rascunho**, sem vigente, até o envio da Rev.00 aprovada.
  - **AUDDOC014 e AUDDOC015:** conteúdo e SHA-256 são da Rev.00 aprovada; apenas a propriedade interna de título do Word ainda diz "Minuta v0.1". Importados como vigentes, com observação.
- **Importação executada (10/10/2026):** 25 arquivos conferidos byte a byte com o manifesto antes do envio; 24 publicados como vigentes e o AUDDOC001 mantido como rascunho; reexecução não duplicou nada (0 importados, 25 existentes). Os modelos técnicos M01/M02 do I6 têm o mesmo SHA-256 dos anexos vigentes AUDDOC010-ANX01/ANX02 — a tela do documento mostra esse vínculo.
- Testes criam documentos fictícios "[TESTE]" com códigos AUDDOC9NN e AUDDOC9NN-ANXMM (faixa reservada a teste no desenvolvimento; não existem no acervo oficial).

### Evidências de teste (10/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 114/114 (I7: 7 de integração — código e vínculo permanentes; revisão só com arquivo no bucket e no caminho do documento; rascunho → vigente com aprovação, Rev.01 substitui e a Rev.00 continua íntegra e acessível (CA-09); imutabilidade do arquivo/SHA-256 e da publicada; cancelamento com motivo; CA-10 — anônimo e não autorizado sem acesso, sem sobrescrita/exclusão/caminho fora do padrão; download na trilha; acervo oficial — AUDDOC001 sem vigente e modelos M01/M02 com o mesmo SHA-256 dos anexos vigentes. Ajustes do I6: 7 unitários + 2 de integração) |
| Playwright — total | 23/23 (I7: acervo oficial com download por link assinado e vínculo ao modelo técnico; AUDDOC001 sem vigente; novo documento → Rev.00 enviada direto ao bucket → confirmação obrigatória → vigente → Rev.01 substitui, Rev.00 baixável com conteúdo original; revisão repetida e tipo de arquivo recusados; celular. I6: item mensal com desconto autorizado e contrato até a emissão; responsividade de 24 telas em 360 px e 768 px) |
| Supabase advisors (segurança) | sem alertas novos |

Observação: numa das rodadas, um passo do e2e do I2 ("inativo não aparece no filtro padrão") falhou uma vez e passou nas repetições isolada e em grupo; registrado como intermitente, a acompanhar no I9.

### Ajuste do I7 pedido na validação (10/10/2026)

**Anexos recolhíveis na lista da biblioteca.** Documentos com anexos aparecem só com a linha do documento principal e um botão com seta para baixo ("N anexos"). Ao clicar, os anexos aparecem logo abaixo, recuados; um novo clique recolhe. Funciona na tabela (computador) e nos cartões (celular). Durante uma busca, os anexos encontrados aparecem já abertos, para que o resultado não fique escondido. Teste e2e acrescentado: AUDDOC010 mostra "6 anexos", abre as 6 linhas e recolhe.

## I8 — Indicadores gerenciais (validado pelo Diretor em 10/10/2026)

**Objetivo:** mostrar ao Diretor, na tela Início, os números do negócio calculados a partir dos registros do sistema, com período selecionável e sem misturar dados de teste com registros reais.
**Requisitos:** AUDDOC017 §14 (indicadores gerenciais), RF-18 (caixa: previsto para V1.1, fora do MVP), CA-11 (indicador conferível com os registros de origem); AUDDOC011 §2 (valores únicos e mensais nunca somados).

Solução:
- Migração `20261010151517_i8_indicadores` (MD5 `e12ba2028df09cf8ec65aa742035f87e`, idêntica ao aplicado): função `audita.dashboard_indicators(de, até, incluir_teste)` com **segurança do chamador** (só calcula o que o usuário já pode ver pelas regras de acesso; anônimo é recusado). Datas avaliadas no fuso America/Sao_Paulo. Somente leitura, sem tabelas novas.
- **Indicadores:** clientes ativos; propostas em aberto (agora e criadas no período); **valor cotado** (última revisão emitida de cada cotação no período); **valor aceito** e **ticket médio aceito**; **conversão** = aceitas ÷ (aceitas + recusadas) no período (aparece "sem dados" quando não há decisões, sem dividir por zero); demandas pendentes, vencidas e recebidas; cotações do período por situação atual.
- Cotação reaberta e aceita de novo conta **uma vez**, pela última revisão. Valores **únicos e mensais aparecem separados**, nunca somados. Aviso fixo: valores de propostas **não são dinheiro recebido**; o caixa fica para a V1.1 (RF-18).
- **Período:** este mês, mês anterior, últimos 30 e 90 dias, ano atual ou personalizado (de/até).
- **Dados de teste:** em produção ficam **fora por padrão**; no desenvolvimento (só há dados fictícios) entram por padrão, com o selo "Inclui dados de TESTE"; um link alterna.
- **Alertas:** sem parâmetros vigentes; propostas emitidas vencidas ou vencendo em até 7 dias; demandas com prazo vencido; pedidos de autocadastro pendentes; rascunhos na biblioteca.
- "Andamento do desenvolvimento" passou a ficar recolhido no fim da página.

### Evidências de teste (10/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` (Vercel) | sem erros |
| Vitest — total | 118/118 (I8: 4 de integração — **CA-11**: cada indicador recalculado de forma independente a partir das tabelas e conferido; variações exatas após criar cliente, demanda, emissão (+R$ 4.237,59), aceite, reabertura com novo aceite (conta uma vez), recusa e conversão; exclusão de dados de teste; período vazio; isolamento — usuário sem permissão vê zeros e anônimo é recusado) |
| Playwright — total | 26/26 (I8: painel com KPIs, alternância de dados de teste, período personalizado e mês anterior (01/09/2026 a 30/09/2026), andamento recolhível, celular sem rolagem horizontal. I7: anexos recolhíveis. Responsividade das telas em 360 px e 768 px, incluindo o Início) |
| Conferência visual | painel no computador e no celular |
| Supabase advisors (segurança) | sem alertas novos |

### Ajustes do I8 pedidos na validação (10/10/2026)

1. **Alertas em destaque:** passaram para o topo do painel, em vermelho-claro, com ícone e contagem; alertas de atenção (parâmetros, prazos e propostas vencidas) têm ainda uma faixa vermelha à esquerda.
2. **Gráficos fáceis de ler**, nas cores do AUDDOC003 (azul `#0296fd` para valor cotado e verde `#4a9f1a` para valor aceito; paleta conferida pelo validador de contraste e daltonismo; verde e vermelho de situação sempre acompanhados de rótulo). Cada gráfico tem título em forma de pergunta e um "Como ler" em linguagem simples:
   - "Quanto cotamos e quanto foi aceito por mês" — colunas dos últimos 6 meses (valores únicos);
   - "Contratos mensais" — o mesmo para valores recorrentes, em gráfico separado (nunca somados aos únicos), exibido quando houver;
   - "Em que etapa estão as cotações do período?" — barras por situação;
   - "Das propostas respondidas, quantas foram aceitas?" — conversão com barra aceitas × recusadas;
   - "As demandas em aberto estão no prazo?" — barra no prazo × prazo vencido.
   A evolução mensal usa a mesma função do banco de cada mês (mesma regra dos indicadores — CA-11). No celular, os indicadores ficam em duas colunas. Sem migração nova.

Testes: e2e do painel ampliado (6 meses no gráfico, "Como ler" em cada gráfico, cor dos alertas, gráfico de conversão vazio sem dados de teste) e responsividade — aprovados; telas conferidas no computador e no celular.


## Planejamento registrado em 10/10/2026 — I9.1 (após a homologação)

Pedido do Diretor na validação do I8, registrado para **depois do I9**, sem desviar do plano:

1. **Tema claro / escuro** — chave no canto inferior esquerdo (junto ao nome do usuário), lembrada por usuário; todas as telas, gráficos e documentos em tela conferidos nos dois temas (os PDFs/DOCX emitidos não mudam).
2. **"Minha conta"** no lugar de "Alterar senha": nome, e-mail, cargo e alteração de senha.
3. **Usuário mestre e criação de usuários** — só o Diretor (usuário mestre) vê e usa "Novo usuário".

Ponto que dependerá de decisão do Diretor antes da implementação (AUDDOC017 §1 e §10): o MVP prevê **um único administrador** e manda "preparar permissões para expansão futura sem exibir papéis fictícios"; os perfis futuros são **Operador administrativo** (cadastra e prepara orçamentos, sem alterar permissões, liberar serviços nem aprovar preços) e **Marketing**. Criar usuários exige definir com qual perfil cada um entra — e as restrições de cada perfil precisam estar no banco (RLS), não só na tela. A criação de usuários usa a chave privilegiada **somente no servidor** (AUDDOC017 §10). Trocar e-mail exige confirmação pelo próprio e-mail.

Como o I9.1 vem depois da homologação, ele terá sua própria regressão completa antes de ser considerado concluído.

**Decisão do Diretor (10/10/2026):** por enquanto, manter **apenas o usuário mestre** (o Diretor). No I9.1, o usuário mestre — e somente ele — poderá criar contas de **qualquer nível** previsto no AUDDOC017 §10 (Administrador, Operador administrativo, Marketing). As permissões de cada nível serão confirmadas pelo Diretor na matriz do documento de pendências (seção do Diretor) e aplicadas no banco (RLS), não só na tela.

## I9 — Homologação do MVP (validado pelo Diretor em 10/10/2026)

**Objetivo:** comprovar, com testes executados e evidências, que o MVP atende aos critérios de aceite CA-01 a CA-12 e aos fluxos do AUDDOC017 §13, antes de qualquer decisão sobre produção.
**Requisitos:** AUDDOC017 §10 (segurança, backups e recuperação testável), §13 (FL-01 a FL-05), §15, §16 (CA-01 a CA-12).

Relatório completo: **`docs/HOMOLOGACAO_MVP.md`**. Lista final de pendências: **`docs/PENDENCIAS_SISTEMA_REAL.md`** (26 itens em 5 etapas, cada um com o AUDDOC).

Solução:
- **Jornada contínua** `tests/e2e/homologacao-i9.spec.ts`: FL-01 → FL-05 → FL-02 → FL-05 (Em execução → Entregue → Encerrada) → FL-03 → painel (variações exatas) → saída. FL-04 fica no I10 (V1.2).
- **Varredura de segurança** que se atualiza sozinha: função `audita.security_self_check()` (só administrador) + `tests/integration/seguranca-i9.test.ts` (todas as tabelas e buckets por chamada direta).
- **CA-12** `tests/unit/ca12-escopo.test.ts`: migrações só no schema `audita` (e buckets/políticas próprias), nenhuma migração destrutiva, nenhum domínio do PRO/HUB e nenhum segredo no Git.
- **Cópia de segurança e restauração** `scripts/backup-restauracao.mjs`: exportação com o login do administrador, restauração num Postgres separado (PGlite) a partir das migrações do repositório e conferência por quantidade de linhas e MD5.
- Migração `20261010164610_i9_autoverificacao` (MD5 `44b2eae468cea11d9d0d40e79ba544b6`, idêntica ao aplicado).
- **Correção (achado H-01):** pesquisa de clientes não usa mais os dígitos soltos de termos com letras para procurar no CNPJ — era também a causa da falha intermitente registrada no I7.

### Evidências de teste (10/10/2026)

| Verificação | Resultado |
|---|---|
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 130/130 (I9: 6 da varredura de segurança, 4 do CA-12, 2 da pesquisa por documento; teste de contadores do I2 atualizado: leitura só do administrador, escrita de ninguém) |
| Playwright — total | 27/27 (I9: jornada completa de homologação; responsividade de todas as telas em 360 px e 768 px) |
| Cópia e restauração | 21/21 tabelas idênticas (linhas e MD5 iguais na origem e na restaurada); 209 arquivos copiados (24 MB), 160 com SHA-256 conferido com o banco, 0 divergências, 0 registros sem arquivo |
| Supabase advisors (segurança) | apenas "proteção contra senhas vazadas desligada" (configuração do painel — pendência 17); o aviso "RLS sem política" dos contadores foi eliminado |

## I9.1 — Minha conta, usuários e tema claro/escuro (validado pelo Diretor em 10/10/2026)

**Objetivo:** atender ao pedido do Diretor (10/10/2026): tema claro/escuro no canto inferior do menu; "Minha conta" no lugar de "Alterar senha" (nome, e-mail, cargo, senha); usuário mestre que cria contas de qualquer nível.
**Requisitos:** AUDDOC017 §1 (operador inicial único; preparar permissões) e §10 (perfis, RLS testada no banco, chave privilegiada só no servidor); AUDDOC013 §8; AUDDOC003 (identidade visual).

**Decisões do Diretor (10/10/2026):** por ora só o usuário mestre (o Diretor) opera; o mestre — e somente ele — cria contas de qualquer nível; pontos em aberto da matriz D7 do caderno ficam no **modo mais restritivo** (sem acesso) até a resposta.

Registro de rastreabilidade: uma execução anterior desta sessão, interrompida, começou o I9.1 com permissões mais amplas para o Operador (preços, emissão, aceite, biblioteca). As migrações dela (`20261010175436_i9_1_usuarios_niveis`, `20261010181151_i9_1_mestre_teste`) e a função `usuarios` já estavam aplicadas no desenvolvimento; o commit `da877c4` ("docs(i9): I9 validado pelo Diretor") levou junto, por engano, os arquivos em andamento dessa execução. Após a escolha do Diretor pelo modo mais restritivo, as permissões foram **restringidas por migração aditiva** — nada foi apagado.

Solução:
- **Níveis** (`app_users.role`): Administrador, Operador administrativo, Marketing. **Usuário mestre** (`is_master`, exatamente um; o Diretor). No desenvolvimento, o administrador fictício de teste é "mestre de teste" (marca separada, exige `is_test`; não existe em produção). Mestre e marca de teste só pela administração do banco, nunca pela API.
- **Modo mais restritivo** — migração `20261010194825_i9_1_permissoes_restritivas` (MD5 `fc0adb89d351c564e289edd8d8d43fa2`): políticas RESTRITIVAS adicionais e funções do fluxo de volta ao administrador.
  - Operador: clientes, unidades, contatos, demandas (inclusive mudança de situação) e preparo de orçamentos (itens, horas, despesas, conteúdo). Não vê parâmetros, preços, margens, revisões, documentos emitidos, autocadastro, biblioteca nem histórico de orçamentos; não conclui revisão, não emite, não registra aceite/recusa, não autoriza desconto, não adota versão de parâmetros (gatilho `pricing_admin_guard` no banco). Na tela, o orçamento aparece sem valores, com aviso de que preço e emissão ficam com o administrador.
  - Marketing: nenhuma tabela além da própria conta até o I10.
- **Gestão de usuários** (só o mestre, em Minha conta): criar (nome, e-mail, cargo, nível, senha provisória gerada com 16 caracteres), redefinir senha provisória, alterar nível e situação (inativar; nada é excluído). A conta de login é criada pela função do Supabase `usuarios` (v2): a chave privilegiada existe só dentro do Supabase; a função confere no banco se quem chama é o mestre e grava o usuário com o token do próprio mestre (trilha correta). **Primeiro acesso exige troca da senha provisória.**
- **Minha conta:** resumo, nome e cargo editáveis, e-mail exibido (troca de e-mail depende de envio de e-mails com domínio próprio — pendência D8), aparência e segurança (alterar senha).
- **Tema claro/escuro:** chave no canto inferior do menu e escolha em Minha conta; gravado na conta e em cookie (a página já abre no tema certo). Tokens do AUDDOC003 redefinidos para fundo azul-marinho profundo; logotipo sobre área branca de proteção; PDFs/DOCX emitidos não mudam.
- **Achado H-02 da homologação corrigido:** avisos de sucesso que chegam pela URL (ex.: "Demanda registrada…") aparecem uma vez e a URL é limpa; não ficam mais na tela após as ações seguintes (verificado na jornada de homologação).
- **Achado da autoverificação:** a função de gatilho `app_users_guard` ficou executável por PUBLIC; corrigido pela migração `20261010195558_i9_1_revoga_guarda` (MD5 `d1475677afcc658e313de6c0b053fa44`). A autoverificação passou a informar se cada política de Storage é permissiva ou restritiva.

### Evidências de teste (10/10/2026)

| Verificação | Resultado |
|---|---|
| Migrações | conferidas antes num banco descartável (`scripts/verificar-migracoes.mjs`) e aplicadas com MD5 idêntico; função `usuarios` publicada e conferida com o repositório |
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 136/136 (I9.1: 6 de integração por chamada direta — níveis e mestre; operador cadastra, prepara orçamento sem preço e é barrado em parâmetros, revisões, documentos, autocadastro, biblioteca, histórico de orçamentos e nas 6 funções do fluxo; marketing sem acesso a nenhuma tabela; conta própria x mestre; função de usuários: só o mestre, criação com troca obrigatória, duplicidade, redefinição e inativação que derruba o acesso) |
| Playwright — total | 31/31, regressão completa repetida após a correção do H-02 (I9.1: tema escuro persistente, mestre cria operador → primeiro acesso troca a senha → operador só vê o seu escopo e o orçamento sem valores → mestre inativa e o acesso cai; item do orçamento sem margem/desconto para o operador; marketing no celular). Uma falha intermitente de login (tempo de 5 s) no e2e do I6 passou na repetição |
| Conferência visual | Início, orçamento, item, clientes, demandas, biblioteca, catálogo, parâmetros e novo cliente no tema escuro; Minha conta do mestre; orçamento do operador; conta do marketing no celular |
| Supabase advisors (segurança) | apenas "proteção contra senhas vazadas" (pendência 17). Desempenho: avisos informativos de políticas permissivas duplicadas (consolidar quando o D7 for respondido) |

### Ajustes do I9.1 pedidos na validação (10/10/2026)

1. **Usuário mestre adicional.** O mestre pode criar (ou promover) outro usuário com as **mesmas permissões e acessos do mestre**, cada um com o próprio login — ex.: a pessoa que opera o sistema no dia a dia. Em "Nível de acesso" aparece **Usuário mestre**. Migração aditiva `20261010205336_i9_1_mestre_adicional` (MD5 `5f3dba401e99c75c69941900bd5476fc`): o mestre titular (o Diretor, único) continua como está; a nova marca `is_comaster` identifica os mestres adicionais e `is_master()` reconhece os dois. Regras no banco: só um mestre concede ou retira a marca (sempre com nível Administrador); **ninguém altera o próprio nível ou situação**; o titular não pode ser alterado nem ter a senha redefinida por outro mestre. Função `usuarios` v3 (nível "mestre", listagem com a marca, proteção do titular e de si mesmo).
2. **Minha conta em blocos recolhíveis.** Ao abrir a página aparecem só os títulos — Informações da conta, Aparência, Segurança e Gerenciamento de usuários; cada bloco abre ao clicar. Dentro do gerenciamento, "Novo usuário" e "Gerenciar acesso e senha" (por usuário) também abrem ao clicar, e os usuários inativos ficam numa lista recolhida.

Testes acrescentados: 1 de integração (mestre adicional: mesmas permissões, lista usuários, altera outros, não altera a si mesmo nem o titular, não redefine a senha do titular; quem não é mestre não concede a marca; titular retira a marca) e 1 e2e (mestre cria outro mestre → primeiro acesso → mesmo menu e gestão de usuários; blocos fechados ao abrir a página). Vitest 13/13 nos arquivos do I9.1 e de segurança; Playwright 5/5 no arquivo do I9.1.

Regressão completa após os ajustes (10/10/2026, junto com o I9.2): Vitest 145/145 e Playwright 35/35 (inclui os testes do I9.1 e do I9.2). A falha intermitente conhecida de login (tempo de 5 s) apareceu uma vez no e2e do I6 e passou na repetição.

## I9.2 — Dados institucionais da AUDITA (em validação)

**Objetivo:** cadastrar razão social, CNPJ, endereço, contatos e responsáveis da AUDITA e ligá-los ao campo "Empresa proponente" das propostas, sem inventar nada: o que não estiver formalizado aparece como PENDENTE até as respostas C1 (contabilidade) e D6 (Diretor) do caderno de pendências.
**Requisitos:** AUDDOC013 §3–§4 (cadastro e identificação); AUDDOC010-ANX01 (campo "Empresa proponente"); AUDDOC010 §7 (constituição, razão social, CNPJ, CNAEs, inscrições e regime pendentes); AUDDOC015 §2 (e-mail oficial); AUDDOC017 CA-08 (snapshot imutável da revisão); CLAUDE.md regra 6.

Solução:
- **Banco** — migração aditiva `20261010210514_i9_2_dados_institucionais` (MD5 `df4cbcc42090ad7f167be1b4c87b1e1b`, conferida antes no PGlite). Tabela `audita.institutional_profiles` em **versões** (rascunho → vigente → substituída), com as mesmas validações do formulário (CNPJ com dígitos verificadores, CEP, UF, e-mail, telefone). O banco define status e número da versão; versão publicada é **imutável** (nem o administrador altera; só a função de publicação muda o status). Publicação por `publish_institutional_profile` (somente administrador). RLS: somente o administrador lê e grava (operador e marketing sem acesso — modo mais restritivo). Trilha de auditoria em criação, edição e publicação. A migração **não carrega dados**.
- **Congelamento nas propostas** — gatilho na criação de cada revisão grava em `snapshot.proponent` os dados da versão vigente (sem as observações internas), como já é feito com os parâmetros. Revisões antigas e revisões sem versão publicada saem com "AUDITA — razão social e CNPJ pendentes de formalização" (texto anterior, preservado).
- **Documentos** — M01: campo "Empresa proponente" com nome, razão social, CNPJ, endereço (opcional), contato e responsável técnico (opcional, só com registro confirmado); o que faltar aparece como **PENDENTE**. M01 e M02: rodapé com nome, CNPJ e contatos quando preenchidos. Marca d'água de teste também quando os dados institucionais forem de teste.
- **Tela** — Configurações → Dados institucionais (somente administrador): situação (o que falta), prévia de como sai na proposta e no rodapé, lista de versões; rascunho com formulário em grupos (identificação, endereço, contato oficial, responsáveis, exibição, observações internas), prévia e publicação com confirmação. Campos essenciais marcados; publicar com essenciais vazios é permitido, com aviso. O card "Usuários" das Configurações passou a levar a Minha conta.
- Signatário e cargo do signatário ficam guardados para os modelos de contrato (M03–M06, V1.1); o M01 atual não tem campo de assinatura da AUDITA.

### Evidências de teste (10/10/2026)

| Verificação | Resultado |
|---|---|
| Migração | conferida no PGlite e aplicada com MD5 idêntico; funções SECURITY DEFINER com `search_path` vazio; anônimo sem execução; RLS ativa |
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 145/145. I9.2: 4 unitários (proponente ausente → texto de pendência; vigente → campo do M01, rodapé do M01/M02, DOCX e PDF; dados parciais → PENDENTE e opções de exibição; validação do formulário igual à do banco) e 4 de integração — 3 num banco descartável com todas as migrações (rascunho, validações, publicação só pelo administrador, vigente anterior substituída, imutabilidade inclusive para superusuário, trilha de auditoria, congelamento no snapshot sem observações) e 1 no banco de desenvolvimento, somente leitura (operador, marketing, sem acesso e anônimo não leem, não gravam e não publicam). O teste de emissão do I6 passou a conferir o proponente no snapshot real |
| Playwright — total | 35/35 (I9.2: Configurações → Dados institucionais, prévia com PENDENTE, erros de CNPJ/CEP/e-mail/telefone sem gravar; operador barrado; celular 390 px sem rolagem horizontal; a rota entrou no teste responsivo) |
| Supabase advisors (segurança) | apenas "proteção contra senhas vazadas" (pendência 17) |

Observação: a publicação **não** é feita nos testes do banco de desenvolvimento (deixaria uma versão de teste vigente); ela é verificada no banco descartável. O e2e deixa um rascunho vazio marcado TESTE (versão 1), reaproveitado nas execuções seguintes.

## I10 — Comunicação, sem IA (em validação)

**Objetivo:** módulo Comunicação com o fluxo FL-04 sem inteligência artificial: modelo → briefing → texto escrito pela equipe → revisão de marca e texto pelo administrador → exportação autorizada e registrada.
**Requisitos:** AUDDOC017 §4 (menu Comunicação), RF-25 (modelos e campanhas com a identidade do AUDDOC003), RF-26 (somente o briefing — a geração por IA continua bloqueada até a decisão D-08 do §18), RF-27 (biblioteca de logos oficiais com versões), RF-28 (exportação só após revisão, com fonte, versão e autorização registradas; nada é publicado ou agendado), §10 (perfil Marketing) e §13 FL-04; AUDDOC003 §01–§04, §06, §11 e §12.

Observação de ambiente (11/10/2026): repositório confirmado como `viniciusrp158-glitch/AUDITA` (remoto atualizado no ambiente de trabalho e no computador do Diretor) e banco `audita-dev`; nada do Audita PRO/HUB foi acessado.

Solução:
- **Banco** — migração aditiva `20261010215009_i10_comunicacao` (MD5 `8a3aa1fc2aa13e1f0ef17ffd210d74bf`, conferida antes no PGlite): `brand_assets` e `brand_asset_versions` (arquivos de marca com SHA-256, dimensões, origem; uma versão aprovada por ativo; versões imutáveis), `comm_campaigns` (código CAM-AAAA-NNN), `comm_pieces` (código COM-AAAA-NNNN; briefing e texto), `comm_piece_versions` (conteúdo congelado a cada envio, com logo, serviço e contatos oficiais do momento) e `comm_exports` (somente inclusão). Bucket privado `audita-marca`. Funções do fluxo: enviar, revisar (aprovar/devolver), reabrir, cancelar, registrar exportação; aprovar logo / cancelar versão.
- **Regras no banco:** só o administrador aprova peças e logos; aprovação exige os 5 itens da revisão (logo sem alteração, identidade, texto, tom de voz, dados reais), **logo oficial aprovado**, **serviço citado “Apto comercialmente”** (AUDDOC004) e **contatos oficiais publicados** quando a peça os mostra. Exportação só de versão aprovada. O marketing cria e edita rascunhos, envia para revisão e exporta o aprovado; vê só os logos aprovados. Operador sem acesso (modo mais restritivo). Sem exclusão física.
- **Peças** — 5 modelos (post quadrado 1080×1080, post retrato 1080×1350, story 1080×1920, capa de apresentação 1920×1080 e comunicado A4), desenhados no servidor com a paleta e a tipografia do AUDDOC003 (Montserrat, licença OFL, subconjunto latino), marcas AUDITA / Audita PRO / Audita HUB (“Uma solução AUDITA”), slogan e assinatura aprovados; logo sobre fundo branco; sem logo aprovado aparece “LOGO OFICIAL PENDENTE”; contatos somente dos dados institucionais (I9.2). Exportação em PNG e PDF, com a faixa “TESTE — SEM VALIDADE” fora da produção.
- **Telas** — Comunicação (contadores, filtros e lista de peças), Nova peça (briefing), Peça (texto com avisos de tom de voz e de excesso de texto por modelo, prévia, envio, revisão com checklist, versão aprovada com exportação e legenda, histórico de versões e de exportações), Campanhas e Biblioteca de marca (paleta, envio por link assinado, conferência e aprovação). O marketing passa a entrar direto em Comunicação.

### Evidências de teste (11/10/2026)

| Verificação | Resultado |
|---|---|
| Migração | conferida no PGlite e aplicada com MD5 idêntico; advisors de segurança: só a pendência 17 |
| `tsc`, `eslint`, `next build` | sem erros nem avisos |
| Vitest — total | 153/153. I10: 4 unitários (5 modelos em PNG e PDF nas dimensões certas, com e sem logo; contatos; avisos de tom de voz e de tamanho) e 4 de integração — 3 no banco descartável (logos: só o administrador envia/aprova, versões imutáveis, marketing vê só a aprovada; peça: fluxo completo com devolução por serviço não liberado e por contatos ausentes, checklist obrigatório, imutabilidade, exportação só aprovada, reabertura, cancelamento, operador barrado, trilha) e 1 no banco real (marketing cria e envia, não aprova; operador, sem acesso e anônimo barrados). Varredura de segurança atualizada com o bucket de marca; teste de níveis atualizado para o marketing |
| Playwright — total | 37/37 (I10: logo aprovado → peça do marketing → aviso “zero multas” → prévia → envio → revisão com checklist → aprovação → exportação PNG (administrador) e PDF (marketing) registradas → cancelamento da peça de teste; operador barrado; 4 telas no celular sem rolagem horizontal; rotas novas no teste responsivo) |

Dados de teste deixados no desenvolvimento: ativo “[TESTE] Logo AUDITA (arquivo do sistema)” com uma versão aprovada (é o arquivo `public/brand/audita-logo.png` já usado no sistema) e peças COM-2026-0001 a 0004 canceladas.

Logos oficiais (10/10/2026): o Diretor enviou os PNGs da AUDITA, do Audita PRO e do Audita HUB; cadastrados como “PNG original” e aprovados na biblioteca de marca (o da AUDITA é idêntico, byte a byte, ao arquivo já usado no sistema). O ativo de teste foi inativado. Cópias em `Documents\AUDITA\_logos_oficiais`.

## V1.1 — Serviço contratado e execução, documentos M03–M06 e caixa gerencial (em validação)

**Objetivo:** concluir os itens da V1.1 que não dependem do caderno de pendências: registrar o serviço contratado a partir da proposta aceita e acompanhar a execução; gerar as minutas M03–M06 a partir dos cadastros; controlar recebimentos e pagamentos efetivos.
**Requisitos:** AUDDOC017 RF-07 (serviço contratado, início/fim, execução, entregáveis, histórico — sem replicar o PRO/HUB), RF-18 (recebimentos e pagamentos, sem substituir a contabilidade), RF-23 (preencher modelos com dados do cliente e evidenciar campos ausentes antes da emissão), RF-24 (histórico de documentos), RF-30 (entradas e saídas efetivas nos indicadores); AUDDOC009 §6.3–§6.5 e §8; AUDDOC010 §2–§4 e ANX03–ANX06; AUDDOC011 §7 e aba “Caixa Mensal” do ANX01. Menu mantido com 7 entradas (AUDDOC017 §4): serviços contratados ficam em Demandas (aba) e o caixa é aberto pelo Início.

Solução:
- **Banco** — migração aditiva `20261011020200_v1_1_execucao_caixa` (MD5 `ad979092c8c81d4183811dc4c595ec5d`, conferida no PGlite): `service_contracts` (CTR-AAAA-NNNN, só a partir de proposta aceita, dados vindos da revisão aceita), `service_contract_events` (linha do tempo somente inclusão), `service_orders` (M05, OS-COM-AAAA-NNNN), `scope_changes` (M06, ALT-AAAA-NNNN), `contract_documents` (arquivos gerados, imutáveis; bucket privado em `contratos/`) e `cash_entries` (caixa, imutável com estorno). Funções: registrar serviço, mudar situação (sincroniza a demanda: Em execução → Entregue → Encerrada), liberar/concluir/cancelar OS (liberação exige responsável, data, atividade e nenhuma condicionante), aprovar/cancelar alteração (aprovação exige aceite rastreável do cliente e validação AUDITA), estornar lançamento. Somente o administrador.
- **Documentos** — M03, M04 (texto-base do ANX04, cláusulas 11 e 12 como PENDENTE de assessoria jurídica), M05 e M06 em DOCX e PDF; contratada a partir dos dados institucionais vigentes (I9.2); campos ausentes listados antes da geração e confirmação para gerar com “[PENDENTE: …]”; sempre “MINUTA — PENDENTE DE REVISÃO JURÍDICA” (e marca de teste fora da produção); SHA-256 registrado.
- **Caixa** — quadro mensal igual à planilha (recebimentos, custos diretos, fixos, pró-labore, tributos, outros, saldo do mês e acumulado), aritmética decimal exata, data futura recusada; Início ganhou “Caixa efetivo” (recebido, pago, resultado do mês e saldo do exercício).
- **Telas** — Demandas → Serviços contratados (lista, ficha com situação, linha do tempo, dados, OS, alterações e documentos); botão “Registrar serviço contratado” na proposta aceita; Caixa gerencial.

### Evidências de teste (11/10/2026)

| Verificação | Resultado |
|---|---|
| Migração | conferida no PGlite e aplicada com MD5 idêntico; advisors de segurança: só a pendência 17 |
| `tsc`, `eslint`, `next build` | sem erros nem avisos |
| Vitest — total | 162/162 (V1.1: 4 unitários — caixa mensal com decimal exato, atividades da OS, M03/M04 com PENDENTE e minuta, M05/M06 — e 5 de integração: 4 no banco descartável com o fluxo completo e as regras, 1 no banco real com as permissões por nível) |
| Playwright — total | 40/40 (V1.1: proposta aceita → serviço → execução → M03 → OS-COM barrada por condicionante e liberada → M05 → alteração barrada sem aceite e aprovada → M06 → entregue/encerrado com a demanda encerrada; caixa com data futura recusada, lançamento e estorno; operador barrado; celular). Teste de demandas ajustado para a nova aba |

## V1.2 — Aplicação do Caderno de Pendências respondido (14/10/2026) — em validação

**Objetivo:** aplicar as respostas do caderno (seções C, J, D e I) e as decisões complementares do Diretor de 14/10/2026 (itens 1–13 da conferência), sem publicar em produção.
**Decisões do Diretor (14/10/2026):** liberar todos os serviços marcados "Apto comercialmente" no D3 (inclusive NR-11, NR-33 e NR-35, "com prática realizada na estrutura do cliente"); manter o banco `audita-dev` e **limpar os dados de teste** antes do uso real; sistema em **audita.seg.br/empresa** (raiz reservada ao site institucional); tributos **0%** com o DAS nas despesas fixas e o valor de impostos omitido na proposta; **pró-labore-alvo R$ 3.000,00**; taxa de cobrança 0% no cálculo com observação de **acréscimo de 5% no cartão**; metas: conversão 30% e 5 demandas/mês; qualificação "Técnico em Segurança do Trabalho, registro MTE nº 0120523"; textos e percentuais entre colchetes confirmados como definitivos; descarte = **somente anonimização**; e-mail do domínio (D8) fica como única pendência; nada vai para a rede até tudo estar pronto.

Solução:
- **Endereço** — `basePath` `/empresa`; a raiz e os caminhos antigos redirecionam para `/empresa` (o site institucional poderá ocupar a raiz depois sem mudar o endereço do sistema). Links de download, logo e retorno de e-mail de senha ajustados. Domínios `audita.seg.br` e `www.audita.seg.br` (redireciona) cadastrados no projeto Vercel `audita`, sem nenhuma publicação de produção.
- **Banco** — migração aditiva `20261015012319_v1_2_caderno` (MD5 `8997680756105937ac5f24227d06ae6e`, conferida no PGlite e aplicada com MD5 idêntico): CPF do titular nos dados institucionais (M04); versão técnica **v2** do M01/M02 (v1 preservada como substituída); tabela `retention_rules` com os 8 prazos do J4; anonimização controlada (`anonymization_candidates`, `anonymize_record` — só o mestre, um registro por vez, com motivo, só após o prazo; trilha sem dados pessoais); **MFA exigido no banco**: quem ativou a verificação em duas etapas só tem papel com sessão `aal2` (`mfa_ok` em `current_app_role` e `is_master`).
- **Documentos** — "Empresa proponente" e rodapé no formato do J1.10 (MEI, atividade pelo CNAE, contatos oficiais, responsável técnico); M01 com a seção 6 "Condições gerais" (mora, reajuste e rescisão dos mensais, alcance e limitações, responsabilidade, foro de Sorocaba); M02 com o proponente e o texto curto de alcance; **M04 aprovado** (contrato de treinamento, cláusulas 1, 5, 6, 8, 10, 11 com tabela de penalidades e 12; sem testemunhas); M03/M05/M06 com "Emitido por…"; marca "MINUTA" retirada (a de teste continua fora da produção).
- **Cotação** — nova cotação já vem com validade de 15 dias, pagamento (Pix/boleto/transferência/depósito no C6 sem acréscimo; cartão +5%; NF após aceite e validação), despesas (sem deslocamento em Sorocaba), reagendamento/cancelamento (J1.04), próximo passo e 12 meses para mensais — tudo editável.
- **Telas** — Início com as metas (D9); Configurações → **Guarda e anonimização**; Minha conta → **Verificação em duas etapas** (QR Code/chave, confirmação, desativação) e etapa de código no login (`/verificacao`).
- **Biblioteca** (carga com `scripts/carga-biblioteca-v1-2.mjs`, pela conta técnica de teste): AUDDOC001 Rev.00 **vigente** com o arquivo aprovado (SHA-256 `6ea2c145…0254`; o registro da minuta passou a apontar para o arquivo aprovado — a minuta AUDPRO001 continua guardada no armazenamento e nunca foi vigente); AUDDOC014 e AUDDOC015 **Rev.01** (só a propriedade de título; Rev.00 substituída); **AUDDOC018** + ANX01–ANX10 Rev.00 vigentes (modelos operacionais aprovados em 12/10/2026).
- **Preparado, aguardando autorização** — `scripts/limpeza-dados-teste.sql` (a execução automática foi barrada pela proteção do ambiente por ser exclusão em massa; precisa de execução/autorização expressa do Diretor) e `scripts/carga-configuracao-real.mjs` (dados institucionais, parâmetros reais e liberações do D3, a rodar logo após a limpeza).

### Evidências de teste (15/10/2026)

| Verificação | Resultado |
|---|---|
| Migração | conferida no PGlite e aplicada com MD5 idêntico; advisors de segurança: só a proteção contra senhas vazadas (painel) |
| `tsc`, `eslint`, `next build` | sem erros |
| Vitest — total | 167/167 (V1.2: MEI/J1.10, M01 com condições gerais, M02 com proponente, M04 aprovado; integração no PGlite — CPF, templates v2, prazos J4, anonimização só pelo mestre e após o prazo com trilha limpa, MFA aal2 no banco) |
| Playwright — total | 43/43 (V1.2: raiz → /empresa, metas e guarda, condições padrão na cotação, MFA completo — ativar, código errado recusado, entrada com código, desativar — com limpeza garantida). Ajustes: URLs com /empresa e tempos maiores nas telas com muitos usuários de teste acumulados |

## Implantação — Supabase próprio e site na VPS (15/10/2026)

**Objetivo:** colocar o Sistema AUDITA de Operação no ar em **https://audita.seg.br/empresa** com os dados reais (prompt de continuidade v2, seção 8, substituído na publicação pelo guia `GUIA-SISTEMA-AUDITA.md` do Diretor).
**Decisões do Diretor (15/10/2026):** remover o usuário `teste01rosalia@hotmail.com`; consultoria SST/DOC/AUD/AMB usa a proposta M01 + aceite, sem contrato (o M04 é só de treinamento); carga real feita com o login do Diretor e conta técnica de teste mantida **inativa e bloqueada** (não apagada, porque registrou a Biblioteca oficial e os logos); publicação em **VPS própria com Supabase self-hosted** (o plano gratuito do Supabase em nuvem deixa de importar); dados copiados do `audita-dev` para a VPS.

Execução, em ordem:
1. **Etapa A (conferência)** — pasta local sincronizada com `develop` (`b1dee76`); `tsc`, `eslint` e `next build` sem erros; Vitest **167/167**; Playwright em lote **13/13** (dois testes que falharam em paralelo passaram um a um: o "Sair" encerra a sessão em todos os aparelhos da mesma conta). Senhas das 4 contas de teste redefinidas só no `.env.local`.
2. **Etapa B (limpeza)** — `scripts/limpeza-dados-teste.sql` revisado antes da execução: corrigida a coluna do ativo de marca (`title`; com `name` o roteiro pararia e nada seria apagado); trilha passou a guardar só o que continua existindo; testado no PGlite. Executado no `audita-dev`: 0 clientes, demandas, propostas, contratos, caixa, peças, convites, parâmetros e dados institucionais; catálogo de volta ao AUDDOC004 (45 serviços, nenhum liberado); Biblioteca com 36 documentos e 37 revisões oficiais; 3 logos oficiais sem marca de teste; trilha com 168 linhas. Varredura `seguranca-i9` 6/6.
3. **Etapa C (carga real)** — `scripts/carga-configuracao-real.mjs` passou a pedir e-mail, senha e CPF na tela, recusa contas `@audita.test` e confirma antes de gravar. Rodado pelo Diretor: dados institucionais v1 e parâmetros v1 **vigentes** publicados por `viniciusrp158@hotmail.com`; **37 serviços/ofertas liberados** e 8 não liberados (TRN-004, ESP-001 a 007). Cotação de conferência pelo motor (8 h, custo direto R$ 0,00): custo/hora R$ 55,17, preço sugerido **R$ 606,83** (com todos os custos diretos vazios o item fica PENDENTE, como na planilha).
4. **Etapa D (usuários)** — conta técnica `admin.teste@audita.test` inativa e bloqueada (marca de mestre de teste retirada, exigida pela regra `app_users_test_master_is_test`); demais 50 contas de teste e `teste01rosalia` removidas. Fica só o mestre real com acesso.
5. **VPS** (`164.68.112.61`, compartilhada com o Audita PRO — nada do PRO foi alterado; conferido ao fim de cada passo):
   - Supabase self-hosted `self-hosted/v0.8.2` em `/opt/supabase-audita`, projeto Compose `supabase-audita`, containers `audita-*`, portas só em loopback (API 8100, Postgres 5442, pooler 6553) — `deploy/vps/docker-compose.vps.yml`; cadastro público desligado; esquema `audita` exposto na API.
   - 23 migrações aplicadas e registradas em `supabase_migrations.schema_migrations` (`deploy/vps/apply-migrations.sh`; MD5 da última `8997680756105937ac5f24227d06ae6e`, igual à nuvem).
   - Dados copiados do `audita-dev` (dump só de dados do esquema `audita` e de `auth.users`/`auth.identities`, feito pelo Diretor com `audita-copiar-banco-nuvem`): **35 tabelas com contagens idênticas** e conteúdo idêntico por MD5 (dados institucionais, catálogo, Biblioteca); 2 usuários com as senhas mantidas. Arquivos: 40 (37 revisões da Biblioteca + 3 logos) baixados por `scripts/migracao-baixar-arquivos.mjs` e enviados ao Storage da VPS, **40/40 conferidos pelo SHA-256**. Cópias temporárias apagadas.
   - Função `usuarios` publicada. Site em container (`deploy/vps/web/`, imagem `audita-sistema:<data>`, `127.0.0.1:3200`, `NEXT_PUBLIC_APP_ENV=producao`); Nginx próprio (`deploy/vps/nginx-audita-sistema.conf`) e HTTPS Let's Encrypt para `audita.seg.br`, `www` e `api`.
   - Backup diário próprio às 04h00 (`/usr/local/bin/audita-sistema-backup`, 14 dias, testado). Comando `audita-email` e modelo de recuperação de senha em português prontos para o SMTP do Brevo.

### Evidências (15/10/2026)

| Verificação | Resultado |
|---|---|
| Serviços do Supabase do AUDITA | 11/11 *healthy* |
| API pela internet | `auth/v1/health` 200; anônimo barrado ao ler `audita.services` (42501); cadastro público recusado (`signup_disabled`); raiz da API 404 |
| Site | `https://audita.seg.br` → `/empresa`; login 200; **o Diretor entrou com o próprio e-mail e senha** |
| Audita PRO | containers `supabase-*` sem reinício; `auditapro.app.br` e API respondendo como antes |
| Advisors do Supabase em nuvem | só "Leaked Password Protection" (o `audita-dev` deixa de ser o banco real) |

Pendente nesta implantação: SMTP do Brevo (autenticar `audita.seg.br` e rodar `audita-email producao`) e teste de "Esqueci minha senha"; ativar a verificação em duas etapas do mestre; retirar o domínio do projeto da Vercel; decidir o destino do `audita-dev` em nuvem (ambiente de testes, com a retirada do CPF, ou pausa).

### Ajustes após a implantação (15/10/2026)

- **E-mail (Brevo)** — domínio `audita.seg.br` autenticado (código Brevo, DKIM `brevo1`/`brevo2`, DMARC e SPF `v=spf1 include:spf.brevo.com -all`), remetente `nao-responda@audita.seg.br`. Na primeira execução de `audita-email producao` o Login SMTP foi digitado no campo da porta: o Auth do AUDITA entrou em reinício contínuo (o que também deixava o site lento); corrigido para a porta 587. "Esqueci minha senha" testado pelo Diretor: e-mail entregue (caiu no spam antes do SPF; domínio novo ganha reputação com o uso).
- **Lentidão** — dentro da VPS a página responde em 0,02 s; a causa é **perda de pacotes na rede do provedor da VPS** (30–40% até destinos próximos; 0% do lado do Diretor). Com autorização do Diretor, **proxy do Cloudflare ligado** nos 3 registros A, SSL **Full (strict)**: conexão + TLS estáveis em ~0,3 s, página de login em 0,6–1 s na maioria das vezes (antes 0,9–9 s) e arquivos fixos servidos pelo cache do Cloudflare (~0,45 s). Os picos ocasionais de ~3 s só somem com a correção do provedor (chamado a abrir pelo Diretor).
- **Logo sem aparecer** — o otimizador de imagens do Next.js não tinha permissão para gravar em `.next/cache/images` dentro do container (pasta copiada como root, processo como `node`); ao converter o logo para WebP/AVIF a gravação falhava e a resposta nunca era enviada (pedido pendurado em todas as telas, o que também aumentava a sensação de lentidão). Corrigido no container em uso (permissão da pasta + reinício do site) e no `deploy/vps/web/Dockerfile` (`COPY --chown=node:node .next`). Logo em WebP de 16 KB: 1 s na primeira vez e 0,01 s em seguida. Renovação do certificado simulada com sucesso pelo proxy do Cloudflare.

### Incidente: conflito de IP na Contabo e cópia de segurança fora da VPS (19–20/10/2026)

- **Sintoma:** `audita.seg.br/empresa` mostrando "404 Not Found — LiteSpeed" e, com o Cloudflare em Full (strict), erro 526 em parte dos acessos.
- **Causa (fora do AUDITA):** outro servidor da Contabo, `vmi3288967.contaboserver.net` (CyberPanel/OpenLiteSpeed, certificado vencido em 07/08/2026), responde no IP 164.68.112.61. Em 20 conexões seguidas, o certificado e a chave SSH da máquina estranha (`SHA256:xdoiwYSn…`) se alternaram com os da VPS do AUDITA (`SHA256:FVocuf2T…`). Explica também a "perda de pacotes" de 15/10. A Contabo atribuiu a uma manutenção de segurança (reinícios dos hosts a partir de 15/10); novo chamado aberto pelo Diretor com as evidências (`_suporte/`, fora do Git).
- **Origem conferida e correta:** certificado Let's Encrypt `audita.seg.br` (com `www` e `api`), válido até 13/01/2027, cadeia completa, renovação automática ativa; `nginx -t` sem erros; HTTP → HTTPS funcionando. Nenhuma alteração no servidor.
- **Cloudflare (token temporário criado pelo Diretor, com escopo de zona):** mantido **Full (strict)** no AUDITA (o modo Full aceitaria o certificado vencido da máquina estranha); ligados "Always Use HTTPS" e TLS mínimo 1.2 nas zonas `audita.seg.br`, `auditapro.app.br` e `auditahub.app.br`, e Full (strict) no HUB, com autorização do Diretor. Proxy do PRO e do HUB continua desligado (essas opções só valem com o proxy).
- **Preparação para trocar de VPS:** backup novo gerado e copiado para o computador do Diretor (`Documents\AUDITA-BACKUP-VPS\2026-10-20_2136`: banco, `.env`, `web.env` e configurações do servidor, conferidos pelo SHA-256; do Storage, 38 de 55 pedaços de 200 KB chegaram antes de o Diretor reinstalar a VPS, o que recupera 34 arquivos — os 40 arquivos do Storage vieram do `audita-dev` em 15/10 e não mudaram depois, então continuam disponíveis lá); comparação dos arquivos da VPS com o repositório (todos iguais, exceto o Nginx com o HTTPS do certbot, agora guardado em `deploy/vps/nginx-audita-sistema.certbot.conf`); novos `scripts/baixar-backup-vps.sh` (download em pedaços com novas tentativas, verificação estrita da chave do servidor) e `deploy/vps/MIGRAR-VPS.md`.
- **VPS reinstalada pelo Diretor em 20/10/2026** para sair do conflito; o sistema fica fora do ar até a reinstalação descrita em `deploy/vps/MIGRAR-VPS.md`.

### Reinstalação na VPS reinstalada (20–21/10/2026)

Com a VPS `vmi3662674` reinstalada pelo Diretor (Ubuntu 24.04 limpo, mesmo IP; conflito de IP ainda ativo), o sistema foi reposto seguindo `deploy/vps/MIGRAR-VPS.md`. A identidade SSH nova (`SHA256:XRzcFZcl…`) foi registrada como a única confiável antes de qualquer senha ser digitada; a chave de acesso foi instalada pelo Diretor.

- **Programas:** Docker 29 / Compose v5.6, Nginx 1.24, certbot; Supabase `self-hosted/v0.8.2` (baixado pelo computador do Diretor, porque a VPS não conseguia baixar do GitHub) com o `.env` original (mesmas chaves e sessões).
- **Banco:** restaurado do backup de 20/10 21h36. Na primeira passagem os usuários não entraram (tabelas do Auth ainda na estrutura inicial); corrigido recarregando só os dados do Auth, completando `auth.schema_migrations` (62 → 77, o Auth estava reiniciando) e reaplicando do backup 5 restrições (`audita.app_users_user_id_fkey`, `auth.identities_pkey` e 3 chaves de `identities`/`sessions`/`one_time_tokens`). Conferência final: **69 tabelas com as mesmas contagens do backup**, 2 usuários, 141 políticas de RLS, 87 funções do esquema `audita`, todos os gatilhos e índices (faltam só restrições internas do pooler, recriadas por ele).
- **Storage: 43 de 46 arquivos.** 34 do backup parcial; 6 da Biblioteca da pasta `_migracao` e 3 PDFs de propostas da pasta Downloads do Diretor, todos com o MD5 igual ao `eTag` registrado no banco. **Perdidos:** os 3 `.docx` das propostas PROP-2026-0001 (Rev00 e Rev01) e PROP-2026-0002 (Rev00); os dados das propostas estão no banco.
- **Site:** imagem `audita-sistema:20261021-0000` (código do `develop` 5ca2084). **Nginx:** arquivo do AUDITA + `deploy/vps/nginx-conf.d/` (IP real do Cloudflare e o `map` do WebSocket, que antes vinha do arquivo do PRO). **HTTPS:** certificado Let's Encrypt `audita.seg.br`/`www`/`api` (até 19/01/2027) emitido pela **validação DNS do Cloudflare**, porque a validação pelo site dependeria de o IP responder; renovação simulada com sucesso.
- **Backup diário e e-mail (Brevo):** repostos e testados (backup de 21/10 00h07 gerado).
- **Pela internet:** login 200 em 9 de 10 acessos; as falhas restantes (526) são do conflito de IP, ainda sem solução da Contabo.
- **Tela branca "Application error" durante o uso (21/10/2026):** a ligação interna site → API na VPS está correta (6/6, sem erros no servidor); a falha ocorre no trecho navegador → Cloudflare → VPS, quando um pedido de tela recebe o 526 do conflito de IP. Criada a tela de erro em português (`src/app/(app)/error.tsx`, `src/app/global-error.tsx`, `src/components/load-error.tsx`): tenta de novo sozinha uma vez por endereço e oferece "Tentar de novo" e "Recarregar a página". `tsc`, `eslint` e `next build` sem erros; publicada como `audita-sistema:20261021-1000`. Teste e2e `tests/e2e/erro-conexao.spec.ts` (simula o 526, computador e celular) escrito, **ainda não executado**: as contas de teste do `audita-dev` foram bloqueadas na etapa D (pendência V4).

### Mudança de servidor (21/10/2026)

Por causa do conflito de IP na Contabo, o Sistema AUDITA (e o Audita PRO/HUB) passou a rodar na **VPS do Leandro**
(`109.205.179.53`, usuário `deploy`, porta SSH 58212, sem root), em Docker atrás do Nginx Proxy Manager. Os dados foram
migrados do backup de 21/10 21h38 do servidor antigo. As 69 tabelas têm as mesmas contagens, o Storage está completo e o
e-mail pelo Brevo foi mantido. As pastas equivalentes ficam em `~/audita/` (`supabase-audita`, `audita-sistema`). O guia
completo está com o Leandro (`README-VPS1.md`). Os roteiros de `deploy/vps/` continuam descrevendo o servidor antigo.

## T1 — Plataforma de Treinamentos, etapa 1: cadastro de treinamentos (22/10/2026) — em validação

O plano está em `docs/TREINAMENTOS.md`. Protótipo aprovado pelo Diretor em 22/10/2026: o padrão visual novo vale só na aba
Treinamentos e as etapas do aluno ficam só na lateral. Os vídeos ficam no YouTube "não listado".

- **Banco** (`20261022180000_t1_treinamentos.sql`, aditiva):
  - treinamentos, versões (rascunho → publicada congelada → nova versão), módulos (Ambientação sempre o M01) e arquivos
    privados com SHA-256, separados em aluno e equipe;
  - RLS só para administradores, gatilhos de imutabilidade e trilha.
- **Telas:**
  - nova aba **Treinamentos** no menu (só administradores);
  - lista, novo treinamento, abas do treinamento (módulos e materiais, ficha técnica, documentos, venda e preço,
    versões) e página de cada módulo, com envio direto ao bucket privado (vários slides de uma vez, em ordem).
- **Ambiente de desenvolvimento novo:** Supabase separado na VPS do Leandro (`~/audita/supabase-audita-dev`, só em
  `127.0.0.1:8200`, acesso por túnel SSH), com dados de teste. O curso L01 v1.2 foi carregado nele com os 7 módulos, a
  ficha técnica e os 141 arquivos.

### Evidências de teste (22/10/2026)

- `tests/integration/treinamentos-t1.test.ts` (PGlite), **6/6**:
  - criação com o M01;
  - operador e visitante bloqueados;
  - ordem dos módulos;
  - arquivos imutáveis, um ativo por tipo, e remoção sem exclusão;
  - publicação com as exigências e versão congelada;
  - nova versão copiando, substituição e cancelamento com motivo.
- Suíte completa: **81 testes passaram** (os demais dependem de banco de desenvolvimento configurado e foram pulados,
  como antes). `tsc` e `eslint` sem erros, e `next build` concluído.
- `tests/e2e/t1-treinamentos.spec.ts`, contra o ambiente de desenvolvimento, **2/2**: o fluxo completo no navegador e o
  celular (390 px) sem rolagem horizontal. O fluxo cobre:
  - cadastro;
  - módulo novo;
  - apostila e slides com a ordem certa;
  - link do YouTube recusado e aceito;
  - arquivo aberto por link assinado (303);
  - ficha técnica;
  - publicação exigindo confirmação;
  - versão congelada;
  - nova versão.
- `tests/e2e/responsivo.spec.ts` não roda no ambiente novo de desenvolvimento, porque ele ainda não tem cliente nem
  serviço cadastrados. É uma pendência do ambiente, não da etapa.

### Publicação da etapa 1 em produção (22/10/2026, com o SIM do Leandro)

- **Backup antes:** `audita-sistema-backup` de 22/10 16h49.
- **Migração:** `20261022180000_t1_treinamentos` aplicada (MD5 igual ao do repositório), 24 migrações registradas,
  bucket `audita-treinamentos` criado.
- **Site:** imagem `audita-sistema:20261022-1950-t1`, gerada da branch `feat/t1-treinamentos-base`. Container saudável;
  `/empresa/login` responde 200 e `/empresa/treinamentos` pede login, como as demais abas. Para voltar:
  `AUDITA_WEB_TAG=20261021-2054-dados` e `docker compose up -d`.
- **Carga do L01 v1.2 em produção**, feita no servidor porque as senhas dos administradores são pessoais:
  - treinamento, versão em **rascunho** com a ficha técnica (4 h, instrutor Vinicius Rocha Pereira) e 7 módulos com
    objetivos, tópicos e minutos;
  - 141 arquivos (8 do aluno e 133 da equipe, dos quais 102 slides em PNG) no bucket privado, com o SHA-256 conferido num
    arquivo baixado de volta.
- **Falta:**
  - colar os links do YouTube;
  - conferir e publicar a versão 1.2;
  - definir preço e prazo de acesso, na aba "Venda e preço".

## T2a — Alunos, matrículas e área do aluno em /treinamentos (22/10/2026) — em validação

O Diretor confirmou o endereço `audita.seg.br/treinamentos` e as três formas de criar alunos. Esta entrega cobre a
matrícula individual e em lote, com convite por e-mail, e a área do aluno (entrar, criar senha, esqueci a senha e Meus
cursos). O cadastro com compra fica para as etapas 5 e 6. Detalhes em `docs/TREINAMENTOS.md`.

### Evidências de teste (22/10/2026)

- `tests/integration/alunos-t2.test.ts` (PGlite), **4/4**:
  - matrícula só pela função, na versão publicada, com prazo padrão, recusa de duplicada e de prazo no passado;
  - aluno restrito ao próprio cadastro e ao conteúdo do aluno, com o arquivo da equipe barrado no armazenamento;
  - outro aluno sem acesso;
  - prazo vencido, matrícula suspensa e aluno inativado cortando o acesso;
  - cancelamento definitivo, com nova matrícula permitida.
- Suíte completa: **85 testes passaram**, e os demais continuam pulados por dependerem de banco configurado. `tsc` e
  `eslint` (sistema e área do aluno) sem erros. `next build` do sistema e `next build aluno` concluídos.
- `tests/e2e/t2-alunos.spec.ts`, contra o ambiente de desenvolvimento com a caixa de testes, **2/2**. O fluxo cobre:
  - matrícula pela aba Alunos e convite lido na caixa de testes (assunto e link certos);
  - senha curta recusada, senha criada e "Meus cursos" com o L01;
  - sair, senha errada recusada e entrar de novo;
  - aluno barrado no sistema da equipe;
  - celular sem rolagem horizontal;
  - matrícula em lote com prévia e resultado por linha (2 de 3, com o e-mail inválido apontado).
- `tests/e2e/t1-treinamentos.spec.ts` repetido: **2/2**.
- Correção encontrada no teste: o retorno do link de convite redirecionava para o host interno do servidor (e perdia o
  cookie da sessão). Agora usa o host e o protocolo que o navegador pediu (`x-forwarded-*`).
