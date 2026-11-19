# Planejamento — Prospecção 2.0 (AUDITA PROSPECT)

**Pedido da Direção (19/11/2026):** prospecção mais refinada, rápida, agradável e pensada para o celular. O sistema
deve entregar as empresas já filtradas e organizadas por chance de resposta, sem que o usuário escolha segmento. Inclui
grandes empresas e deixa de lado as muito pequenas. Mensagem automática de WhatsApp com o texto da Direção, e-mail de
apresentação bonito, envio para vários leads de uma vez, correção do número de contato e painel de indicadores.

**Referência:** AUDDOC020 Rev.00 (vigente desde 17/11/2026). Vários pedidos mudam decisões aprovadas nele. Pela regra 1
do projeto, os conflitos estão na seção 3 e dependem da decisão do Diretor. Depois da decisão, gero o **AUDDOC020
Rev.01** como rascunho na Biblioteca (regra 12) e só então implemento o que mudou.

---

## 1. Diagnóstico (medido, não estimado)

### 1.1 A base de empresas (produção, até 60 km de Sorocaba)

| Achado | Número | O que significa |
|---|---|---|
| Microempresas (ME) | 128.266 | 45% da região. São as "muito pequenas" que a Direção quer deixar de lado |
| Empresas de pequeno porte (EPP) | 42.168 | Público certo |
| Porte "Demais" | 111.629 | **Não quer dizer "grande".** 37 mil são produtor rural pessoa física, 8 mil associações e 4 mil condomínios. Só 43 mil Ltda e 4,5 mil S.A. |
| Grupos com 3 ou mais estabelecimentos | 6.525 | Bom sinal de média/grande empresa |
| MEI / empresário individual | 0 | Já fica fora da base desde a carga (17/11) |
| Telefone repetido em 5 ou mais CNPJs | 95.399 de 272.843 (35%) | **É o telefone da contabilidade.** Explica o problema relatado pela Direção |
| E-mail repetido em 5 ou mais CNPJs | 86.424 de 253.927 (34%) | Idem (ex.: 3.395 com @contabilizei.com.br) |
| Celulares na base | 42 | A Receita quase não traz celular: o WhatsApp sai do fixo ou do número confirmado |

**Conclusões:**
1. O sistema consegue **descobrir sozinho** quando o contato é da contabilidade: o mesmo número ou e-mail aparece em
   muitas empresas. Hoje ele não faz isso.
2. "Grande empresa" precisa de outro sinal. O **capital social** vem no arquivo público da Receita, mas ainda não é
   carregado. Somam-se a natureza jurídica (S.A.) e o número de filiais.
3. A nota atual (v1) dá **mais pontos à EPP (20) e à ME (16) que ao porte "Demais" (12)**, porque seguiu o público
   "pequenas e médias" do AUDDOC005. Isso vai contra o novo pedido.

### 1.2 Lentidão

| Tela (ambiente de testes) | Tempo | Causa principal |
|---|---|---|
| Pesquisar | **7,2 a 7,4 s** | Busca, pontuação e checagem de "já é lead/cliente" calculadas na hora, para até 1.000 empresas |
| Ficha do lead, Funil, Regiões | 3,0 a 3,5 s | Várias consultas em sequência, sem aviso de carregamento (parece travado) |
| Painel, Resultados | 2,2 a 2,6 s | Idem |

O servidor de produção tem **4 núcleos e 7,8 GB, divididos com o Audita PRO**. Dois painéis de banco do AUDITA ficam
ligados o tempo todo consumindo CPU (`audita-meta` ~27% e `auditadev-meta` ~29%), e o ambiente de testes mantém 10
contêineres ligados mesmo sem uso. O RNF-P06 do AUDDOC020 pede pesquisa em até 3 s.

---

## 2. Solução proposta

### 2.1 "Oportunidades do dia": o sistema filtra e entrega pronto
- Uma **carteira pré-calculada** (tabela nova, atualizada à noite e a cada carga mensal da Receita) com todas as
  empresas da região que se encaixam nos nichos. A pessoa **não escolhe segmento**: abre a prospecção e as melhores já
  estão lá, separadas em grupos. A tela "Pesquisar" continua existindo para buscas específicas.
- **Filtros automáticos** (ajustáveis pela Direção): sem MEI (já é assim), sem ME muito pequena (critério na pergunta
  1), sem associação, produtor rural pessoa física e condomínio (salvo decisão contrária), sem quem já é lead, cliente
  ou "não contatar".
- **Grandes empresas incluídas** com prioridade, reconhecidas por S.A., número de filiais e capital social (passa a
  ser carregado da base pública; migração aditiva e nova carga).

### 2.2 Nota v2 e grupos por **chance de resposta**
Além da aderência ao portfólio, a nota passa a estimar a **chance de a empresa responder**:

| Sinal | Efeito |
|---|---|
| Telefone ou e-mail próprio (não repetido em outras empresas) | Sobe bastante: alguém da empresa atende |
| Contato da contabilidade (repetido em 5 ou mais CNPJs) | Desce; a ficha mostra "contato provável da contabilidade" |
| E-mail com domínio próprio (ex.: @empresa.com.br) | Sobe: empresa mais estruturada |
| Média/grande (S.A., filiais, capital) e EPP | Sobem; ME desce |
| Aderência do CNAE, distância de Sorocaba, tempo de atividade | Como hoje |

**Grupos:** 🔥 **Quentes** (chance alta), 🙂 **Mornos**, ❄️ **Frios** e **Precisa de contato** (só existe o contato
da contabilidade: pesquisar o número real antes). Cada empresa mostra **por que** está no grupo.

*Honestidade:* sem histórico, a chance é uma **estimativa por regras**. Com 4 a 6 semanas de uso, o painel compara a
estimativa com as respostas reais e os pesos são recalibrados (o AUDDOC020 RP-14 já prevê isso, com volume mínimo).

### 2.3 Número de contato corrigível (aprende com a correção)
- Botão **"Corrigir número"** ao lado do telefone, na própria ficha e no modo prospecção, com máscara. Hoje existe o
  quadro "Contato confirmado", mas fica no fim da página.
- Botão **"É da contabilidade"**: marca o número como de contador. **Todas as outras empresas** com esse número
  descem para "Precisa de contato". Assim o sistema aprende com cada correção.

### 2.4 **Modo prospecção** (celular primeiro, sem páginas longas)
Uma empresa por tela, em cartão:
- Nome, porte, segmento, distância e "por que está aqui" em 3 linhas.
- Botões grandes: **WhatsApp · Ligar · E-mail**, já com a mensagem pronta.
- Resultado em **um toque**: Respondeu · Sem resposta · Não atendeu · Reunião marcada · Retornar em… · Não contatar.
- **Próxima** (passar para o lado no celular). A análise completa abre num painel por cima, sem sair da tela.

No computador, o mesmo cartão aparece ao lado de uma lista. O fluxo vai do grupo "Quentes" para os "Mornos" na ordem.

### 2.5 Mensagens prontas
- **WhatsApp:** texto da Direção, preenchido com o nome do usuário e o nome da empresa (ver pergunta 4 sobre a linha de
  saída exigida pelo AUDDOC020 RP-10).
- **E-mail de apresentação:** e-mail em HTML que funciona no celular, com o logotipo, uma ilustração de abertura,
  três blocos curtos (Treinamentos NR · Consultoria SST · Meio Ambiente/SGI) e o botão "Conversar pelo WhatsApp". Só
  usa dados já aprovados (Dados institucionais e Catálogo), nada inventado. O rascunho vai para a aprovação da
  Direção.
  - *Limite técnico:* o link de e-mail que abre o Outlook (`mailto`) **não aceita imagem nem formatação**. O e-mail
    bonito precisa ser enviado pelo próprio sistema (pergunta 3).

### 2.6 Envio para vários leads de uma vez
- **WhatsApp — "Fila de envio" (recomendado):** a pessoa marca os leads (ou "todos os Quentes") e o sistema abre uma
  conversa por vez com a mensagem pronta. Ela toca em enviar no WhatsApp, volta, e o sistema registra o contato e
  abre a próxima. São cerca de 10 segundos por empresa, **sem custo e sem risco para o número da AUDITA**.
  - O disparo 100% automático só é permitido pela **API oficial do WhatsApp**. Ela é paga por mensagem, exige que a
    empresa tenha **aceitado** receber mensagens antes (o primeiro contato frio não é permitido) e está fora do
    escopo aprovado (AUDDOC020, teto de R$ 0). Robôs não oficiais violam os termos do WhatsApp e levam ao
    **bloqueio do número da empresa**.
- **E-mail em lote:** envio pelo sistema, com o e-mail de apresentação, para os leads marcados. Inclui link de
  descadastro (que alimenta o "não contatar"), limite diário e registro de cada envio. Exige um remetente com domínio
  próprio (@audita.seg.br) e um serviço de envio. Há planos gratuitos de até 300 e-mails/dia (pergunta 3). O Outlook
  pessoal proíbe envio em massa e bloqueia a conta.
- **LGPD:** o AUDDOC020 condiciona **ampliar os contatos** à validação do advogado (base legal de legítimo
  interesse). O envio em lote ficaria pronto, mas **bloqueado até essa validação** ser registrada.

### 2.7 Painel de gestão e mais diversão
- **Painel em uma tela:** meta do dia (ex.: 25 contatos), quentes ainda não contatados, retornos de hoje, respostas,
  reuniões, propostas e clientes. Inclui taxa de resposta por grupo (calibra a chance), por canal, por mensagem e por
  segmento, mais os leads parados e as oportunidades de melhoria em destaque ("WhatsApp responde 3x mais que e-mail
  em Construção").
- **Mais divertido, sem perder a seriedade:** barra de progresso da meta do dia, sequência de dias com meta batida,
  comemoração discreta ao marcar reunião ou ganhar cliente e resumo da semana ("você falou com 31 empresas; 6
  responderam").

### 2.8 Velocidade
- Lista de oportunidades vinda da carteira pré-calculada (abre em menos de 1 s; nada é calculado na hora).
- Aviso de carregamento imediato em todas as telas (a tela responde ao toque na hora).
- Menos consultas em sequência por tela (paralelas, em cache onde possível).
- Pesquisa avulsa dentro dos 3 s do RNF-P06.
- Servidor: desligar o painel de banco de produção (`audita-meta`/Studio, usado só em manutenção) e o ambiente de
  testes quando ninguém estiver testando. São contêineres do AUDITA, sem tocar no Audita PRO (regra 2). Precisa de
  autorização (pergunta no fim).

---

## 3. Conflitos com o AUDDOC020 Rev.00 (decisão do Diretor)

| # | Aprovado no AUDDOC020 | Pedido agora | Proposta |
|---|---|---|---|
| C1 | WhatsApp assistido; "disparo automático fora do escopo"; sem API oficial | Várias mensagens de uma vez | Fila de envio assistida (2.6), sem API |
| C2 | E-mail individual aberto no Outlook (engenharia.audita@outlook.com) | E-mail bonito e em lote | Envio pelo sistema com remetente @audita.seg.br e serviço gratuito |
| C3 | Modelos "com identificação da AUDITA e opção de saída" (RP-10) | Texto do WhatsApp sem linha de saída | Acrescentar uma linha curta de saída |
| C4 | Porte: público "pequenas e médias" (nota v1, AUDDOC005) | Incluir grandes e deixar de lado as muito pequenas | Nota v2 (2.2) |
| C5 | Advogado valida antes de ampliar os contatos (RNF-P04) | Envio em lote | Lote pronto, liberado após a validação |
| C6 | Teto de R$ 0,00/mês | Serviço de e-mail | Plano gratuito; nada pago sem nova decisão |

Após as respostas, gero o **AUDDOC020 Rev.01** (rascunho para aprovação na Biblioteca), sem mudar o resto do documento.

---

## 4. Plano de execução

Cada fase é publicada separadamente no sistema real para validação, com testes em computador e celular e o registro
em `docs/HISTORICO.md`. Nada destrutivo no banco; migrações só aditivas.

| Fase | Entrega | Depende de |
|---|---|---|
| **0 — Decisões** | Respostas às perguntas; AUDDOC020 Rev.01 em rascunho; aprovação na Biblioteca | Diretor |
| **1 — Base refinada e rápida** | Capital social e filiais na base (migração aditiva + recarga); detecção de contato de contabilidade; nota v2 e grupos de chance; carteira pré-calculada; avisos de carregamento; contêineres ociosos desligados | Fase 0 (critérios de porte) |
| **2 — Modo prospecção** | "Oportunidades do dia" por grupo; cartão de uma empresa por vez; resultado em um toque; corrigir número / "é da contabilidade"; nova mensagem de WhatsApp | Fase 1 |
| **3 — Envio em lote e e-mail** | Fila de envio do WhatsApp; e-mail de apresentação em HTML (rascunho para aprovação); envio de e-mail em lote com descadastro e limite diário | Remetente e serviço de e-mail; validação do advogado para liberar o lote |
| **4 — Painel e diversão** | Painel de gestão em uma tela; metas, sequência e comemorações; comparação estimativa × resposta real | Fase 2 |

A ordem entrega valor já na Fase 1 (lista refinada e rápida) e deixa o envio em lote para quando as condições
técnicas e jurídicas estiverem resolvidas.

---

## 5. Perguntas para a Direção

As quatro primeiras definem o desenho e foram enviadas na conversa. As demais podem ser respondidas depois.

1. **Microempresas (ME):** excluir todas, manter só as com sinal de estrutura (capital social ou filiais) ou manter com
   prioridade baixa?
2. **WhatsApp para vários leads:** aprovar a Fila de envio assistida (sem custo e sem risco de bloqueio) no lugar do
   disparo automático?
3. **E-mail bonito e em lote:** criar o remetente @audita.seg.br e uma conta no serviço gratuito, ou manter o envio
   individual pelo Outlook (sem imagem)?
4. **Texto do WhatsApp:** acrescentar a linha de saída do RP-10 e trocar "indústrias" pelo segmento da empresa (ex.:
   "construtoras") quando ela não for indústria?
5. Produtor rural pessoa física, associações e condomínios: deixar fora da prospecção? (Condomínio e produtor rural
   têm obrigações de SST, por exemplo NR-31 e PCMSO, mas costumam ter baixo retorno.)
6. Grandes empresas: até que distância de Sorocaba (presencial)? Sugestão: 80 km.
7. Meta diária de contatos para o painel (hoje a meta é 25 contatos **por semana**).
8. Quem é o advogado e quando pode validar o envio em lote (RNF-P04)?
9. Autoriza desligar o painel de banco de produção (`audita-meta`/Studio) e o ambiente de testes quando não estiverem
   em uso? Ligo de novo quando precisar.

---

## 6. Decisões da Direção (19/11/2026)

| Tema | Decisão |
|---|---|
| Microempresas (ME) | Só com sinal de estrutura: **capital social ≥ R$ 100 mil** ou filiais |
| Produtor rural PF, associações e condomínios | **Fora** da prospecção automática (continuam acessíveis na Pesquisa avulsa) |
| Grandes empresas | Prioridade até **150 km** de Sorocaba |
| WhatsApp para vários leads | **Fila de envio assistida** aprovada (sem API, sem disparo automático) |
| E-mail bonito e em lote | **Remetente @audita.seg.br + serviço gratuito de envio** |
| Texto do WhatsApp | Texto da Direção **+ linha de saída** (RP-10) **+ segmento da empresa** no lugar de "indústrias" quando não for indústria |
| Servidor | Autorizado desligar o painel de banco (Studio/meta) e o ambiente de testes quando ociosos — **feito em 19/11** |

**Pendentes (não bloqueiam as Fases 1 e 2):**
- Meta diária de contatos do painel (hoje: 25 por semana).
- Advogado e data da validação jurídica, que libera o envio em lote (RNF-P04).
- Ações da Direção para o e-mail: criar o endereço (ex.: contato@audita.seg.br), criar a conta gratuita no serviço
  de envio (eu indico o serviço e o passo a passo; a senha fica com a Direção) e dar acesso ao DNS do domínio
  audita.seg.br para os registros de autenticação (SPF/DKIM/DMARC), que evitam cair no spam.

**Próximo passo:** AUDDOC020 Rev.01 (rascunho para aprovação na Biblioteca) com estas decisões. Em seguida, Fase 1.

---

## 7. Lista para começar (19/11/2026)

**Já resolvido (verificado):** o domínio audita.seg.br já está autenticado no **Brevo** (SPF, DKIM e DMARC ativos
desde 15/10) e o DNS fica no Cloudflare. Não é preciso criar um serviço novo nem mexer no DNS. Os dados institucionais
vigentes têm telefone (15) 99689-1049, e-mail engenharia.audita@outlook.com e site audita.seg.br. Há 37 serviços aptos
comercialmente no catálogo. O domínio **não tem caixa de entrada** (sem MX), então respostas a um remetente
@audita.seg.br não chegariam.

**A. Definições da Direção**
1. Meta diária de contatos (sugestão: 15 por dia útil).
2. E-mail comercial: nome do remetente, endereço (sugestão: prospeccao@audita.seg.br) e para onde vão as respostas
   (sugestão: engenharia.audita@outlook.com).
3. Conta Brevo: usar a mesma conta que envia os e-mails do sistema (recuperação de senha) ou uma conta separada para
   a prospecção (recomendado: se a prospecção gerar denúncias de spam, a conta suspensa não derruba os e-mails de
   acesso ao sistema).
4. Limite de e-mails de prospecção por dia (sugestão: 50) e confirmação do plano Brevo atual (limite diário da conta).
5. Confirmar que (15) 99689-1049 é o WhatsApp Business da AUDITA (vai no botão do e-mail).
6. Rótulo "grande empresa" (sugestão: S.A., 3 ou mais filiais ou capital social ≥ R$ 5 milhões; "média" a partir de
   R$ 1 milhão).
7. Prazo de guarda de leads sem resposta (RNF-P04; sugestão: 12 meses, depois anonimizar).
8. Advogado: nome e data da validação (legítimo interesse, linha de saída, e-mail em lote). Até lá, o envio em lote
   fica pronto e bloqueado.

**B. Autorizações permanentes para este projeto (Fases 1 a 4)**
1. Migrações aditivas em produção (capital social, filiais, carteira de oportunidades, marcação de contato de
   contabilidade, registro de envios), com backup antes.
2. Nova carga da base de CNPJ da Receita (publicação mais recente, com capital social), em horário de pouco uso.
3. Tarefa noturna no servidor (usuário deploy) para recalcular a carteira.
4. Publicar cada fase no sistema real, com backup antes, para validação.
5. Ligar e desligar o ambiente de testes conforme a necessidade.
6. Registrar o AUDDOC020 Rev.01 como rascunho na Biblioteca (regra 12).
7. Usar no servidor a credencial do Brevo, sem exibi-la: copiar a chave de um arquivo do servidor para outro, ou a
   Direção cola a chave numa tela de configuração do sistema.

**C. Só a Direção pode fazer**
1. Na conta Brevo: criar a chave de API (ou a conta separada) e liberar o remetente escolhido. Eu passo o passo a
   passo; a chave nunca passa pela conversa.
2. Aprovar o AUDDOC020 Rev.01 e o modelo do e-mail na Biblioteca.
3. Fazer os envios reais (o sistema prepara; quem envia é o usuário) e o primeiro teste: um e-mail e um WhatsApp para
   um contato próprio da Direção.
4. Obter a validação jurídica.
