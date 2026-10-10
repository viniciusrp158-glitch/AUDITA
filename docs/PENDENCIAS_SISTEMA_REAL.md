# Pendências para o sistema AUDITA real (registro em construção)

> Pedido do Diretor (10/10/2026): ao final da versão de teste, entregar a lista completa, **em ordem de execução** e **associada ao AUDDOC** correspondente, com tudo o que precisa ser definido/preenchido para o sistema rodar de verdade.
> Este arquivo é atualizado a cada incremento; a versão final e revisada sai após o I9 (homologação).
> Legenda — **Quem**: D = Diretor; C = contador; J = assessoria jurídica; S = desenvolvimento do sistema.

| # | Pendência | AUDDOC | Quem | Onde entra no sistema | Origem |
|---|---|---|---|---|---|
| 1 | Formalizar a empresa: razão social, CNPJ, CNAEs, inscrições e regime tributário | AUDDOC010 §7; AUDDOC015 | D, C | Dados institucionais (proponente nas propostas — hoje "pendentes de formalização") | S0, I6 |
| 2 | Cadastrar os dados institucionais no sistema (tela ainda não construída) | AUDDOC013; AUDDOC010 M01 | S, D | Configurações → Dados institucionais | I2, I6 |
| 3 | Definir os parâmetros financeiros reais com o contador: pró-labore, despesas fixas, horas faturáveis, tributos, taxas de recebimento, comissão, contingência, margem-alvo e desconto máximo | AUDDOC011 §§3–4 e ANX01 (aba Parâmetros) | D, C | Configurações → Parâmetros financeiros (nova versão → publicar) | I5 |
| 4 | Avaliar os 33 serviços (e as 12 ofertas de treinamento) e decidir quais serão liberados, com verificação de documentos, responsável técnico e recursos | AUDDOC004; AUDDOC005 §14; AUDDOC012 | D | Configurações → Catálogo de serviços (decisão com fundamento) | I3, I6 |
| 5 | Definir o modelo de preço do Audita HUB/PRO como serviço (SaaS), hoje "sem modelo definido" | AUDDOC011 §6 | D, C | Catálogo (SIS-001/SIS-002) e motor de preço | I3, I5 |
| 6 | Definir as condições comerciais padrão: pagamento, despesas adicionais, reagendamento/cancelamento, validade usual | AUDDOC010 M01 §4; AUDDOC011 §7 | D, J | Conteúdo da proposta (hoje preenchido a cada cotação) | I6 |
| 7 | Revisão jurídica dos modelos comerciais (M01 proposta, M02 orçamento e demais anexos) antes do uso externo | AUDDOC010 §7 | J | Modelos de documentos (nova versão técnica, se o texto mudar) | I6 |
| 8 | Revisão jurídica do termo do autocadastro de clientes (LGPD) | AUDDOC013; AUDDOC017 | J | Autocadastro por link | I2.1 |
| 9 | Definir o processo e o eventual fornecedor de assinatura/aceite eletrônico (hoje o aceite é registrado com data, nome e referência) | AUDDOC017 §18 | D, J | Registro de aceite da proposta | I6 |
| 10 | Ambiente de produção: aplicar as migrações validadas no projeto Supabase corporativo, publicar na Vercel e apontar o subdomínio do audita.seg.br | AUDDOC017 §18; CLAUDE.md | D, S | Infraestrutura (sob autorização do Diretor) | I1, I2.1 |
| 11 | Segurança da conta: ativar MFA do administrador e a proteção contra senhas vazadas | AUDDOC017 (RNF segurança) | D | Painel do Supabase | I1 |
| 12 | Provedor de e-mail para avisos (novas solicitações de cadastro, recuperação de senha com domínio próprio) | AUDDOC017 | D | Autenticação e autocadastro | I2.1 |
| 13 | Enviar o arquivo **aprovado** da Rev.00 do AUDDOC001 (PDA): o arquivo do dossiê ainda é a minuta (status "Rascunho", data e responsável "[Inserir…]", tamanho diferente do índice da Fase 1) | AUDDOC001; AUDDOC017 §18 | D | Biblioteca → AUDDOC001 → enviar revisão e publicar | I7 |
| 14 | Harmonizar a propriedade interna de título dos arquivos Word do AUDDOC014 e AUDDOC015 (ainda dizem "Minuta v0.1"; conteúdo e SHA-256 já são da Rev.00 aprovada) — em revisão controlada | AUDDOC001; AUDDOC014; AUDDOC015 | D | Biblioteca (nova revisão, se o Diretor optar) | I7 |
| 15 | Definir a política de desconto por família de serviços (hoje: desconto até o máximo dos parâmetros, com autorização expressa registrada) | AUDDOC011 §§4.6, 5 e 7 | D, C | Parâmetros financeiros e autorização no item | I6 |
| 16 | Definir metas para os indicadores (ex.: conversão, ticket médio, valor cotado por mês) e planejar o caixa — entradas e saídas efetivas — para a V1.1 | AUDDOC017 §14 e RF-18 | D, C, S | Início (indicadores); módulo de caixa na V1.1 | I8 |

## Observações
- No ambiente de **desenvolvimento** há dados e decisões fictícias, sempre marcadas TESTE: parâmetros "[TESTE] Parâmetros fictícios…", liberação fictícia de SST-001, SST-009, DOC-002, TRN-001 e TRN-NR06 (decisão do Diretor de 09/10/2026) e propostas emitidas com marca d'água. **Nada disso vai para a produção**: as migrações não carregam dados de teste.
- Itens marcados com S dependem de desenvolvimento ainda não feito; os demais são definições/documentos que o sistema já está pronto para receber.
