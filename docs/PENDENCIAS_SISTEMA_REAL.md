# Pendências para o sistema AUDITA real — lista final (após a homologação I9)

> Pedido do Diretor (10/10/2026): ao final da versão de teste, entregar a lista completa, **em ordem de execução** e **associada ao AUDDOC** correspondente, com tudo o que precisa ser definido/preenchido para o sistema rodar de verdade.
> Versão final emitida em 10/10/2026, após a homologação do MVP (ver `HOMOLOGACAO_MVP.md`). Novas pendências entram por revisão deste arquivo.
> **Caderno de respostas:** `docs/Caderno_Pendencias_Sistema_AUDITA_v1.0.docx` — as mesmas pendências organizadas por responsável (contabilidade, jurídico, Diretor, implantação), com campos para preencher e o AUDDOC de cada item.
> **Quem**: D = Diretor; C = contador; J = assessoria jurídica; S = desenvolvimento do sistema.
> **Bloqueia o uso real?** Sim = sem isso o sistema não deve operar com clientes reais; Não = pode vir depois.

## Etapa A — Empresa e regras de negócio (definições do Diretor)

| # | Pendência | AUDDOC | Quem | Onde entra no sistema | Bloqueia? |
|---|---|---|---|---|---|
| 1 | **Formalizar a empresa**: razão social, CNPJ, CNAEs, inscrições e regime tributário (hoje as propostas mostram "razão social e CNPJ pendentes de formalização") | AUDDOC010 §7; AUDDOC015 | D, C | Dados institucionais (item 13) e cabeçalho das propostas | Sim |
| 2 | **Parâmetros financeiros reais** com o contador: pró-labore, despesas fixas, horas faturáveis, tributos, taxas de recebimento, comissão, contingência, margem-alvo e desconto máximo | AUDDOC011 §§3–4 e ANX01 (aba Parâmetros) | D, C | Configurações → Parâmetros financeiros (nova versão → publicar) | Sim |
| 3 | **Política de desconto** por família de serviços (hoje: até o máximo dos parâmetros, com autorização expressa registrada no item) | AUDDOC011 §§4.6, 5 e 7 | D, C | Parâmetros e autorização no item | Não |
| 4 | **Avaliar os 33 serviços e as 12 ofertas de treinamento** e decidir quais serão liberados, com verificação de documentos, responsável técnico e recursos (no oficial, só "Apto comercialmente" gera proposta) | AUDDOC004; AUDDOC005 §14; AUDDOC012 | D | Configurações → Catálogo de serviços (decisão com fundamento) | Sim |
| 5 | **Condições comerciais padrão**: pagamento, despesas adicionais, reagendamento/cancelamento, validade usual | AUDDOC010 M01 §4; AUDDOC011 §7 | D, J | Conteúdo da proposta (hoje preenchido a cada cotação) | Não |
| 6 | **Modelo de preço do Audita HUB/PRO** como serviço (SaaS), hoje "sem modelo definido" — SIS-001/SIS-002 continuam sem proposta até lá | AUDDOC011 §6 | D, C | Catálogo e motor de preço | Não |
| 7 | **Metas dos indicadores** (conversão, ticket médio, valor cotado por mês) | AUDDOC017 §14 | D | Início (indicadores) | Não |

## Etapa B — Documentos e revisão jurídica

| # | Pendência | AUDDOC | Quem | Onde entra no sistema | Bloqueia? |
|---|---|---|---|---|---|
| 8 | **Revisão jurídica dos modelos comerciais** (M01 proposta, M02 orçamento e demais anexos) antes do uso externo | AUDDOC010 §7 | J | Modelos de documentos (nova versão técnica, se o texto mudar) | Sim |
| 9 | **Revisão jurídica do termo do autocadastro** de clientes (LGPD) | AUDDOC013; AUDDOC017 §10 | J | Autocadastro por link | Sim, para usar o autocadastro |
| 10 | **Processo de aceite / assinatura eletrônica** e eventual fornecedor (hoje o aceite é registrado com data, nome e referência) | AUDDOC017 §18 | D, J | Registro de aceite da proposta | Não |
| 11 | Enviar o arquivo **aprovado** da Rev.00 do **AUDDOC001** (PDA): o arquivo do dossiê ainda é a minuta (status "Rascunho", data e responsável "[Inserir…]") | AUDDOC001; AUDDOC017 §18 | D | Biblioteca → AUDDOC001 → enviar revisão e publicar | Não |
| 12 | Harmonizar a propriedade interna de título dos arquivos Word do **AUDDOC014 e AUDDOC015** (ainda dizem "Minuta v0.1"; conteúdo e SHA-256 já são da Rev.00) — em revisão controlada, se o Diretor optar | AUDDOC001; AUDDOC014; AUDDOC015 | D | Biblioteca (nova revisão) | Não |

## Etapa C — Ajustes do sistema antes da implantação

| # | Pendência | AUDDOC | Quem | Onde entra no sistema | Bloqueia? |
|---|---|---|---|---|---|
| 13 | **Tela de dados institucionais** (razão social, CNPJ, endereço, contatos da AUDITA) usada nas propostas — recebe os dados do item 1 | AUDDOC013; AUDDOC010 M01 | S | Configurações → Dados institucionais | Sim |
| 14 | **Matriz de permissões (D7 do caderno)** — o I9.1 já está implementado no modo mais restritivo: o mestre cria contas de qualquer nível; Operador administrativo só faz o que o AUDDOC017 §10 define (clientes, demandas, preparar orçamentos sem preços); Marketing sem módulos até o I10. Cada "?" respondido no D7 será liberado por nova migração, com testes. Consolidar as políticas duplicadas (aviso de desempenho do Supabase) nessa mesma migração | AUDDOC017 §1 e §10; AUDDOC013 §8 | D, S | Minha conta → usuários; políticas do banco | Não |
| 15 | **Provedor de e-mail** com domínio próprio (recuperação de senha, avisos de novas solicitações de cadastro) | AUDDOC017 §10 | D, S | Autenticação e autocadastro | Sim |
| 16 | ~~Aviso de sucesso que permanece na tela após ações seguintes (achado H-02)~~ — **resolvido no I9.1** | AUDDOC017 §15 | S | Telas de demanda/cliente | Não |

## Etapa D — Implantação em produção (somente com autorização expressa do Diretor)

| # | Pendência | AUDDOC | Quem | Onde entra no sistema | Bloqueia? |
|---|---|---|---|---|---|
| 17 | **Segurança das contas**: ativar MFA do administrador e a proteção contra senhas vazadas no Supabase | AUDDOC017 §10 | D | Painel do Supabase | Sim |
| 18 | **Banco de produção**: decidir o projeto (o AUDDOC017 prevê o banco corporativo compartilhado com o PRO); inventário prévio, confirmação de backups e plano de rollback; aplicar as 14 migrações validadas **somente no schema `audita`**; ao expor o schema na API, **acrescentar** `audita` à lista existente, **sem retirar** os schemas do PRO (achado H-04) | AUDDOC017 §11, §12, §18; CLAUDE.md | D, S | Infraestrutura | Sim |
| 19 | **Publicar na Vercel** (produção) com `NEXT_PUBLIC_APP_ENV=production` e apontar o subdomínio do audita.seg.br | AUDDOC017 §18 | D, S | Infraestrutura | Sim |
| 20 | **Carga inicial real**: usuário do Diretor; parâmetros (item 2) publicados; liberações (item 4); importação do acervo oficial com o roteiro `importar-dossie.mjs`; **nenhum** dado de teste levado | AUDDOC017 §10; AUDDOC004; AUDDOC011 | D, S | Configurações e Biblioteca | Sim |
| 21 | **Backup em produção**: rotina do plano contratado no Supabase (cópias diárias/recuperação) e **novo ensaio de restauração** com o roteiro `backup-restauracao.mjs` **antes** de cadastrar dados reais | AUDDOC017 §10 | D, S | Infraestrutura | Sim |
| 22 | **Regressão completa no ambiente de produção** (sem dados de teste persistentes) e conferência das telas no celular | AUDDOC017 §15 | S | — | Sim |
| 23 | Limpeza controlada de arquivos sem registro deixados por emissões recusadas (achado H-03); em produção, monitorar | AUDDOC017 §10 | S | Storage | Não |
| 27 | **Prazos de retenção e descarte** por categoria de registro (o sistema hoje não exclui nada — inativação lógica); descarte/anonimização só com decisão registrada | AUDDOC013 §9 e §14; AUDDOC015-ANX01 R028/R039 | J, D | Regra de retenção e rotina aprovada | Sim (piloto) |

## Etapa E — Próximas versões (fora do MVP)

| # | Pendência | AUDDOC | Quem | Bloqueia? |
|---|---|---|---|---|
| 24 | **V1.1**: caixa gerencial (entradas e saídas efetivas), serviço contratado/execução, preenchimento automático dos anexos ANX03–ANX06 | AUDDOC017 §2, RF-07, RF-18, RF-23 | D, S | Não |
| 25 | **I10 / V1.2 — Comunicação e marketing**: aprovar provedor de IA, custos e tratamento de dados **antes** de qualquer integração | AUDDOC017 RF-25 a RF-28, §18 (D-08) | D, S | Não |
| 26 | **Integração com Audita PRO / HUB**: somente em estágio próprio, após inventário dos três sistemas | AUDDOC014; AUDDOC017 §12 | D, S | Não |

## Observações
- No ambiente de **desenvolvimento** há dados e decisões fictícias, sempre marcadas TESTE: parâmetros "[TESTE] Parâmetros fictícios…", liberação fictícia de SST-001, SST-009, DOC-002, TRN-001 e TRN-NR06 (decisão do Diretor de 09/10/2026) e propostas emitidas com marca d'água. **Nada disso vai para a produção**: as migrações não carregam dados de teste.
- Ordem recomendada: A e B podem andar em paralelo (Diretor, contador e jurídico); C é desenvolvimento; D só começa com A1, A2, A4, B8, C13 e C15 resolvidos e com autorização expressa do Diretor.
