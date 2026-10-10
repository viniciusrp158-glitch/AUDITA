# Relatório de homologação do MVP — Sistema AUDITA de Operação (I9)

**Data:** 10/10/2026 · **Ambiente:** desenvolvimento (projeto Supabase `audita-dev`, somente dados fictícios) · **Referência:** AUDDOC017 Rev.00 §13, §15, §16
**Versão homologada:** branch `feat/i9-homologacao` (inclui I1–I8 validados pelo Diretor)
**Natureza:** evidência técnica de testes. Não é autorização de uso comercial: a ida para produção é um passo separado, sob autorização do Diretor (ver `PENDENCIAS_SISTEMA_REAL.md`).

## 1. Resultado

| Item | Resultado |
|---|---|
| Critérios de aceite CA-01 a CA-12 | **12/12 atendidos** com teste automatizado (tabela 2) |
| Fluxos FL-01, FL-02, FL-03, FL-05 | **Atendidos** de ponta a ponta numa jornada contínua no navegador |
| FL-04 (Marketing) | **Fora do MVP** (AUDDOC017 §2, V1.2) — previsto no I10 |
| Testes automáticos (Vitest) | **130/130** aprovados (unitários, integração com o banco e RLS) |
| Testes no navegador (Playwright) | **27/27** aprovados (computador e celular) |
| Compilação (`tsc`, `eslint`, `next build`) | sem erros |
| Varredura de segurança (RLS, permissões, Storage) | **sem falhas**; alerta de segurança do Supabase restante: proteção contra senhas vazadas (configuração do painel — pendência 17) |
| Cópia de segurança e restauração | **Restauração idêntica**: 21/21 tabelas com mesma quantidade de linhas e mesma assinatura MD5 do conteúdo; 160 arquivos com SHA-256 conferido |

## 2. Critérios de aceite (AUDDOC017 §16)

| CA | Esperado | Evidência (teste automatizado) | Resultado |
|---|---|---|---|
| CA-01 | Login não autorizado bloqueado; administrador entra/sai com sessão protegida | `rls-i1` (senha errada, usuário não autorizado), `i1-acesso` (e2e), jornada `homologacao-i9` (tela interna sem sessão → login; Sair → telas internas bloqueadas) | ✅ |
| CA-02 | Cliente fictício com código persistente; busca; edição e inativação não reciclam código | `clientes-i2` (concorrência de códigos), `i2-clientes` (e2e), jornada | ✅ |
| CA-03 | Mesmo cliente com duas unidades e contatos, sem duplicar o cadastro | `clientes-i2` CA-03, `i2-clientes`, jornada | ✅ |
| CA-04 | Serviço não liberado sinalizado e sem proposta final | `catalogo-i3`, `emissao-i6` (bloqueio no banco), `i6-emissao` RF-17 (TRN-NR35 bloqueado) | ✅ |
| CA-05 | Parâmetros faltantes ⇒ PENDENTE e nenhum preço | `pricing-engine`, `precificacao-i5` | ✅ |
| CA-06 | Cálculo sintético reproduz o AUDDOC011 (custo, preço, margem pós-desconto) | `pricing-engine` (casos conferidos com a planilha ANX01), jornada (R$ 4.237,59) | ✅ |
| CA-07 | Desconto acima do permitido e denominador inválido ⇒ aviso/bloqueio | `pricing-engine` (REVER DESCONTO / REVER VALORES), `desconto-contrato`, `emissao-i6` (autorização forjada acima do máximo recusada) | ✅ |
| CA-08 | Proposta emitida mantém conteúdo e parâmetros após mudança dos parâmetros gerais | `emissao-i6` CA-08 | ✅ |
| CA-09 | Documento oficial com código/revisão; revisão posterior mantém a anterior acessível | `biblioteca-i7`, `i7-biblioteca`, jornada (AUDDOC011 vigente, SHA-256, download) | ✅ |
| CA-10 | Arquivo privado inacessível sem autenticação/permissão; RLS testada por chamada direta | **`seguranca-i9`** (todas as tabelas e os dois buckets, por chamada direta), `emissao-i6`, `biblioteca-i7` | ✅ |
| CA-11 | Painel confere com os dados sintéticos e não confunde orçamento com dinheiro recebido | `indicadores-i8` (cálculo independente), jornada (variações exatas: +1 cliente, +1 demanda, +R$ 4.237,59 cotado e aceito), aviso "não dinheiro recebido" | ✅ |
| CA-12 | Sem chamadas, chaves, alterações ou migrações do PRO/HUB | **`ca12-escopo`** (varredura de todas as migrações, código e roteiros; nenhum segredo no Git), projeto de banco separado | ✅ |

## 3. Fluxos (AUDDOC017 §13) — jornada contínua `homologacao-i9`

1. **FL-01 Cliente:** pesquisa sem resultado → cadastro com CNPJ → código CLI → unidade → contato vinculado → histórico.
2. **FL-05 Demanda:** registro a partir do cliente, com unidade, contato e serviço.
3. **FL-02 Orçamento:** cotação → item precificado pelo motor → conteúdo do M01 → Rev.00 congelada → emissão DOCX/PDF com marca d'água → download → aceite (a demanda passa a "Aceita").
4. **FL-05 (continuação):** Em execução → Entregue → Encerrada, com a linha do tempo completa.
5. **FL-03 Biblioteca:** pesquisa do AUDDOC011 → revisão vigente com SHA-256 → download pelo link assinado.
6. **CA-11:** o painel mostra exatamente o que foi feito na jornada.
7. **CA-01:** saída do sistema e bloqueio das telas internas.

Telas da jornada: `90-homologacao-proposta-aceita.png`, `91-homologacao-demanda-encerrada.png`, `92-homologacao-painel.png`.

## 4. Varredura de segurança (AUDDOC017 §10)

Nova função `audita.security_self_check()` (somente administrador; lê só o catálogo do banco) e teste `seguranca-i9`, que se atualiza sozinho quando surgir tabela nova:

- 21 tabelas: todas com RLS ligada e política; **nenhum** privilégio para `anon` ou PUBLIC; nenhuma view exposta.
- 50 funções: todas com `search_path` vazio; `anon` executa **somente** `invite_context` e `submit_registration` (autocadastro).
- Por chamada direta, tabela por tabela: anônimo não lê; usuário autenticado sem cadastro no AUDITA não lê, não insere, não altera e não exclui (uma linha real de cada tabela é usada como alvo e continua intacta).
- Buckets `audita-documentos` e `audita-biblioteca`: privados, com limite de tamanho e tipos; Storage só com políticas de leitura/envio para administrador; anônimo e não autorizado não listam, não baixam, não geram link assinado e não enviam; **nem o administrador** sobrescreve ou apaga um arquivo.
- Migração `20261010164610_i9_autoverificacao` (MD5 `44b2eae468cea11d9d0d40e79ba544b6`, idêntica ao aplicado): cria a autoverificação e permite ao administrador **ler** os contadores de código (necessário à cópia de segurança; escrita continua exclusiva da função `allocate_code`). Isso também eliminou o aviso "RLS sem política" do Supabase.

## 5. Cópia de segurança e restauração (AUDDOC017 §10)

Roteiro `scripts/backup-restauracao.mjs` (login do administrador, sem chave privilegiada):

1. **Cópia:** 21 tabelas exportadas em CSV (texto exato do Postgres) e 209 arquivos (24 MB) baixados dos buckets; 160 arquivos referenciados no banco com SHA-256 conferido, **0 divergências**, **0 registros sem arquivo**.
2. **Restauração** num Postgres separado e descartável (PGlite 0.5.8, Postgres 17): estrutura recriada aplicando as 14 migrações do repositório, dados carregados, numerações (identity) continuadas.
3. **Conferência:** as 21 tabelas têm **a mesma quantidade de linhas e a mesma assinatura MD5 do conteúdo** na origem (consulta no banco de desenvolvimento) e na base restaurada; as funções do sistema funcionam na base restaurada (administrador reconhecido; indicadores calculados).

Observação: 49 arquivos do bucket de propostas não têm registro no banco — são restos dos **testes negativos** de emissão (tentativas propositalmente recusadas pelo banco, como emissão sem marca d'água ou repetida). Não são acessíveis a ninguém além do administrador e não afetam dados; ficam como pendência menor de limpeza controlada (pendência 23).

Limites do teste: as contas de login (Supabase Auth) e a cópia física do banco são geridas pelo Supabase; em produção, a rotina de backup do plano contratado e um novo ensaio de restauração antes de dados reais estão na lista de pendências (pendência 21).

## 6. Achados durante a homologação

| # | Achado | Tratamento |
|---|---|---|
| H-01 | Pesquisa de clientes: termos com letras e números (ex.: "Jornada MV2X25") usavam os dígitos soltos para procurar no CNPJ e traziam clientes sem relação. Era também a causa da falha intermitente registrada no I7 (pesquisa por código CLI encontrava um CNPJ com os mesmos dígitos). | **Corrigido**: só termos que são documento (números e pontuação) pesquisam CNPJ/CPF; testes unitários acrescentados. |
| H-02 | Mensagem de sucesso "Demanda registrada com o código…" continua visível após as ações seguintes na mesma tela. | Cosmético, sem efeito nos dados; incluído no I9.1. |
| H-03 | Arquivos sem registro deixados pelos testes negativos de emissão. | Pendência menor de limpeza (pendência 23). |
| H-04 | A migração do I1 que expõe o schema na API **substitui** a lista de schemas expostos. No projeto corporativo (compartilhado com o PRO) ela precisa **acrescentar** `audita`, sem retirar os schemas do PRO. | Registrado como passo obrigatório da implantação (pendência 18). |

## 7. Telas e celular

Responsividade verificada em 360 px e 768 px em todas as telas (`responsivo.spec.ts`), além dos testes específicos de celular de cada módulo.
