# Pendências para o sistema AUDITA real — lista final (após a homologação I9)

> Pedido do Diretor (10/10/2026): ao final da versão de teste, entregar a lista completa, **em ordem de execução** e **associada ao AUDDOC** correspondente, com tudo o que precisa ser definido/preenchido para o sistema rodar de verdade.
> Versão final emitida em 10/10/2026, após a homologação do MVP (ver `HOMOLOGACAO_MVP.md`). Novas pendências entram por revisão deste arquivo.
> **Caderno de respostas:** `docs/Caderno_Pendencias_Sistema_AUDITA_v1.0.docx` — as mesmas pendências organizadas por responsável (contabilidade, jurídico, Diretor, implantação), com campos para preencher e o AUDDOC de cada item.
> **Quem**: D = Diretor; C = contador; J = assessoria jurídica; S = desenvolvimento do sistema.
> **Bloqueia o uso real?** Sim = sem isso o sistema não deve operar com clientes reais; Não = pode vir depois.

## Situação após a implantação na VPS (15/10/2026)

O sistema está no ar em **https://audita.seg.br/empresa**, com Supabase próprio na VPS (detalhes e evidências em `HISTORICO.md`). Da tabela abaixo (V1.2), A e B foram concluídos; D deixa de valer (o banco real saiu do plano gratuito do Supabase em nuvem); F foi substituído pela publicação na VPS. O que falta:

| # | Pendência | Quem | Bloqueia? |
|---|---|---|---|
| V1 | ~~E-mail (D8)~~ — **concluído em 15/10/2026** (Brevo autenticado, SPF/DKIM/DMARC, recuperação de senha testada). Acompanhar se os e-mails saem do spam; endurecer o DMARC (`p=quarantine`) depois de algumas semanas | D | Não |
| V7 | **Perda de pacotes na rede da VPS** (30–40%): abrir chamado no provedor informando o servidor `vmi3662674` (IP 164.68.112.61). O proxy do Cloudflare (ligado em 15/10/2026, SSL Full strict) reduz o efeito, mas não elimina | D | Não |
| V2 | Ativar a **verificação em duas etapas** do usuário mestre (decisão I3.01) | D | Não |
| V3 | Retirar `audita.seg.br` e `www.audita.seg.br` do projeto `audita` da Vercel (não é mais usado) | D, S | Não |
| V4 | Decidir o destino do `audita-dev` em nuvem: voltar a ser **ambiente de testes** (retirando o CPF do titular e os dados reais) ou pausar | D | Não |
| V5 | Copiar periodicamente os backups de `/var/backups/audita-sistema` para fora da VPS | D | Não |
| V6 | Proteção contra senhas vazadas no Supabase self-hosted (conferir se o Auth da VPS oferece) | S | Não |
| E, H, I | Inscrição municipal; modelo SaaS do SIS-001/002; consultoria pelo M01 + aceite (decisão de 15/10/2026: sem contrato) | D | Não |

## Situação após o caderno respondido (15/10/2026 — V1.2)

Resolvidos no sistema: 1, 2 (parâmetros prontos para carga), 3, 4 (decisões prontas para carga), 5, 7, 8, 9, 10, 11, 12, 13, 14 (mantido o modo restritivo), 16, 24 (minuta retirada), 27, MFA do item 17. O que falta:

| # | Pendência | Quem | Bloqueia? |
|---|---|---|---|
| A | **Autorizar/executar a limpeza dos dados de teste** do `audita-dev` (`scripts/limpeza-dados-teste.sql`) e, em seguida, a carga real (`scripts/carga-configuracao-real.mjs`: dados institucionais, parâmetros com pró-labore-alvo R$ 3.000,00 e liberações do D3) e a remoção dos usuários de teste | D, S | Sim |
| B | Decidir o usuário `teste01rosalia@hotmail.com` (administrador ativo, não marcado como teste) | D | Sim |
| C | **E-mail do domínio** (D8): contratar a caixa/serviço de envio para `nao-responda@audita.seg.br` e configurar o SMTP do Supabase; até lá, convites e recuperação de senha usam o envio padrão do Supabase | D, S | Sim |
| D | Ativar a **proteção contra senhas vazadas** no painel do Supabase (Authentication → Policies); no plano gratuito pode não estar disponível | D | Sim |
| E | Inscrição municipal (C1.09) — preencher nos dados institucionais quando houver | D | Não |
| F | **Publicação**: variáveis de produção na Vercel (`NEXT_PUBLIC_APP_ENV=producao`), merge em `main`, DNS no Cloudflare (A `@` 76.76.21.21; CNAME `www` cname.vercel-dns.com; proxy desligado) e URL de retorno `https://audita.seg.br/empresa/auth/confirm` permitida no Supabase (Authentication → URL Configuration) | D, S | Sim |
| G | Remover pelo painel do Storage os arquivos antigos de teste (sem registro apontando para eles) | D | Não |
| H | Modelo de preço SaaS do SIS-001/SIS-002 (liberados, mas sem cálculo automático — AUDDOC011 §6) | D | Não |
| I | Contrato M04 aprovado é de **treinamento** (cláusula 1.2 exclui consultoria/auditoria): para os serviços SST/DOC/AUD/AMB liberados, usar M01 com aceite ou ajustar o contrato com o jurídico | D, J | Não |

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
| 13 | ~~Tela de dados institucionais~~ — **resolvido no I9.2 (10/10/2026)**: Configurações → Dados institucionais, em versões, ligada ao campo "Empresa proponente" e ao rodapé das propostas. Falta só preencher e publicar com as respostas do item 1 (caderno C1/D6) | AUDDOC013; AUDDOC010 M01 | S | Configurações → Dados institucionais | Sim (só o preenchimento) |
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
| 24 | ~~V1.1~~ — **implementado em 11/10/2026** (serviço contratado e execução, M03–M06 como minutas com campos PENDENTES, caixa gerencial e indicadores de caixa). Falta só a revisão jurídica dos modelos (item 8 / caderno J2) para retirar a marca de minuta | AUDDOC017 §2, RF-07, RF-18, RF-23 | J | Não |
| 25 | **I10 / V1.2 — Comunicação e marketing**: módulo **sem IA implementado no I10** (marca, campanhas, peças, revisão e exportação). Para ligar IA: aprovar provedor, custos, tratamento de dados e revisão humana (decisão D-08) | AUDDOC017 RF-25 a RF-28, §18 (D-08) | D, S | Não |
| 26 | **Integração com Audita PRO / HUB**: somente em estágio próprio, após inventário dos três sistemas | AUDDOC014; AUDDOC017 §12 | D, S | Não |

## Observações
- No ambiente de **desenvolvimento** há dados e decisões fictícias, sempre marcadas TESTE: parâmetros "[TESTE] Parâmetros fictícios…", liberação fictícia de SST-001, SST-009, DOC-002, TRN-001 e TRN-NR06 (decisão do Diretor de 09/10/2026) e propostas emitidas com marca d'água. **Nada disso vai para a produção**: as migrações não carregam dados de teste.
- Ordem recomendada: A e B podem andar em paralelo (Diretor, contador e jurídico); C é desenvolvimento; D só começa com A1, A2, A4, B8, C13 e C15 resolvidos e com autorização expressa do Diretor.
