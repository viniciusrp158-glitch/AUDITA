# Planejamento — Evolução do Sistema AUDITA de Operação e AUDITA PROSPECT

**Data:** 14/11/2026 · **Situação:** proposta para decisão do Diretor · **Nada foi implementado.**

**Premissa de atuação.** Este planejamento foi elaborado no papel de arquiteto de software sênior e estrategista de
negócios, com foco em plataformas SaaS, inteligência comercial, automação de vendas, geolocalização, integração de APIs,
CRM e aquisição de clientes B2B. O objetivo é transformar a AUDITA | SSMA & SGI em uma empresa capaz de identificar
oportunidades, mapear mercados, encontrar empresas com potencial de contratação e gerar leads qualificados de forma
automatizada e escalável, começando pelos **primeiros clientes**.

**Regras que continuam valendo.** Todas as funcionalidades atuais são mantidas. Tudo novo vive no schema `audita`, com
migrações aditivas, RLS e GRANT mínimo; nada de Audita PRO / Audita HUB é tocado; nenhuma chave privilegiada vai para o
navegador ou para o Git; nenhum dado, preço ou necessidade é inventado (ausente = PENDENTE / "não disponível").

---

## 0. Resumo executivo

1. **Duas frentes.** Frente A: melhoria geral do sistema (telas, navegação, uso no celular). Frente B: o módulo novo
   **AUDITA PROSPECT** (prospecção B2B com mapa, qualificação, CRM e automação).
2. **Recomendação de ordem:** começar pelo MVP do PROSPECT, porque é o que gera receita, construindo junto os componentes
   de interface que depois são reaproveitados para melhorar as telas existentes (tabela, filtros, quadro em colunas,
   painel lateral, busca global).
3. **Duas descobertas mudam o desenho pedido** (detalhes na seção 3):
   - **Google Maps não pode ser usado como banco de leads.** Os termos proíbem copiar e guardar nomes, endereços e
     telefones vindos do Maps. Só o identificador do lugar (`place_id`) pode ser guardado sem prazo.
     **Solução:** o cadastro permanente do lead vem da **base pública de CNPJ da Receita Federal** (que pode ser
     guardada e tem CNAE, endereço, telefone, e-mail e data de abertura) e do que o usuário registrar. O Google Maps
     entra como **descoberta por palavra-chave, mapa e ficha ao vivo** (telefone, site, avaliação, situação).
   - **A API oficial do WhatsApp não permite primeiro contato frio.** A Meta exige autorização prévia (opt-in) de quem
     recebe. **Solução:** primeiro contato por WhatsApp **manual assistido** (um clique abre a conversa com a mensagem
     pronta, você envia, o sistema registra), mais telefone e e-mail. A API oficial entra depois, para quem respondeu ou
     autorizou.
4. **Custo estimado do MVP: US$ 0 por mês de APIs**, se o uso ficar dentro das franquias gratuitas do Google (seção 9),
   com trava de consumo dentro do sistema. IA é opcional e só entra com teto aprovado por você.
5. **O que preciso de você:** as respostas da seção 14 (11 perguntas). Sem elas eu decidiria coisas que são suas.

---

## 1. Arquitetura atual (levantada no código e no servidor, não presumida)

| Camada | O que existe hoje |
|---|---|
| Aplicação | Next.js 15 (React 19, server actions), TypeScript, Tailwind; 41 telas; 7 itens de menu (Início, Clientes, Demandas, Orçamentos, Biblioteca, Treinamentos, Configurações); tema claro/escuro |
| Banco | Supabase próprio (PostgreSQL) na VPS, schema `audita`, ~50 tabelas, RLS em todas, trilha de auditoria (`audit_log`) |
| Acesso | Supabase Auth com MFA; níveis mestre / administrador / operador |
| Fluxo comercial atual | Cliente → Demanda → Orçamento (precificação AUDDOC011) → Proposta/aceite → Serviço/OS → Caixa |
| Outros apps | Site institucional (`site/`), portal do aluno EAD (`aluno/`), 5 funções de borda (alunos, certificado, Mercado Pago, usuários, vitrine) |
| Documentos | Geração de Word/PDF no servidor; Biblioteca com revisões e SHA-256 |
| Infra | VPS única compartilhada com PRO/HUB, containers `audita-*`, Nginx, backup diário, tarefas agendadas no servidor (`deploy/servidor/cron`) |
| Integrações já contratadas | Brevo (e-mail), Mercado Pago (EAD), Cloudflare (DNS) |
| Interface | Biblioteca de componentes pequena (6 componentes gerais + formulários); sem tabela padrão, sem busca global, sem quadro em colunas, sem mapa |

**Consequência para o PROSPECT:** ele entra como um módulo nativo (`/prospeccao`), na mesma aplicação, mesmo banco, mesma
autenticação e mesma identidade visual. Não é um sistema à parte e não exige reconstrução de nada.

**O que ainda preciso conferir antes de codificar (eu mesmo faço, na Fase 0):** espaço em disco da VPS para o recorte da
base de CNPJ; se o PostgreSQL do servidor tem `pg_cron` ou se as rotinas ficam no cron do servidor; saída de internet dos
containers para as APIs; política de segurança do Nginx para carregar o mapa.

---

## 2. Frente A — Melhoria do sistema existente

Ainda **não fiz a auditoria tela a tela**; os itens abaixo são o plano de trabalho, e o diagnóstico de cada tela sai da
Fase 0 (capturas das 41 telas em computador e celular, com lista de problemas priorizada para você aprovar).

| # | Melhoria | Benefício | Tamanho |
|---|---|---|---|
| A1 | **Auditoria de usabilidade** das 41 telas (computador e celular) com relatório e prioridades | Decidir com evidência o que mexer primeiro | P |
| A2 | **Sistema de design**: tabela padrão (ordenar, filtrar, paginar, exportar CSV), estados vazios, carregamento, avisos de sucesso/erro, painel lateral, abas, caminho de navegação | Telas consistentes e mais rápidas de construir | M |
| A3 | **Menu reorganizado por área**: Comercial (Prospecção, Clientes, Demandas, Orçamentos) · Operação (Serviços, Treinamentos) · Gestão (Caixa, Biblioteca, Configurações). Serviços e Caixa hoje ficam "escondidos" dentro de outras telas | Menos cliques, tudo visível | P |
| A4 | **Busca global** (atalho Ctrl+K): cliente, lead, demanda, orçamento, documento | Achar qualquer coisa em segundos | M |
| A5 | **Início "Meu dia"**: retornos agendados, demandas paradas, orçamentos a vencer, leads novos, funil resumido | Abrir o sistema e saber o que fazer | M |
| A6 | **Ficha 360° do cliente**: linha do tempo única (contatos da prospecção, demandas, orçamentos, serviços, documentos) | Histórico completo em uma tela | M |
| A7 | **Quadro em colunas** também para Demandas e Orçamentos (mesmo componente do CRM) | Visão do andamento por etapa | P (depois do CRM) |
| A8 | **Cadastro de cliente por CNPJ**: digita o CNPJ e o sistema preenche razão social, endereço e CNAE pela base pública | Menos digitação e menos erro | P (depois da base CNPJ) |
| A9 | **Formulários**: máscaras, salvar rascunho, validação mais clara, etapas nos formulários longos | Menos retrabalho | M |
| A10 | **Celular**: listas em cartões, ações principais sempre visíveis, revisão de contraste do tema escuro | Uso real em campo | M |
| A11 | Filtros salvos e exportações nas listas principais | Relatórios sem pedir ao desenvolvedor | P |

Tamanho: P = pequeno, M = médio, G = grande (esforço relativo, não prazo).

---

## 3. Restrições que definem o desenho do PROSPECT

### 3.1 Google Maps Platform (política oficial consultada em 14/11/2026)

| Regra | Efeito no projeto |
|---|---|
| `place_id` pode ser guardado sem prazo | É a chave permanente de cada empresa vista no Maps |
| Latitude/longitude: cache de no máximo 30 dias | Coordenadas do Google ficam com data de validade e são apagadas/renovadas |
| Proibido "exportar, extrair ou copiar" conteúdo do Maps para uso fora do serviço; citados expressamente nomes de empresas, endereços e avaliações; proibido download em massa | **Não guardamos** nome, endereço, telefone, site ou nota vindos do Google. Eles são exibidos **ao vivo**, com a marca "Google Maps", sempre que a ficha é aberta |
| Proibido criar conteúdo derivado do conteúdo do Maps | O Índice de Oportunidade (IOC) e a pontuação do lead são calculados com dados da Receita e do nosso CRM, **não** com dados do Google |
| Busca por texto: até 20 resultados por página e 60 por consulta | Para cobrir uma cidade, o sistema divide a área em quadrículas e combina com as palavras-chave ("mapeamento automático"), sempre dentro da cota |

### 3.2 WhatsApp Business Platform (documentação oficial da Meta consultada em 14/11/2026)

- A Meta exige **opt-in antes de a empresa enviar mensagens**; o opt-in deve dizer claramente que a pessoa aceita receber
  comunicação daquela empresa. Qualidade baixa leva a limitação de envio.
- Mensagens iniciadas pela empresa só com **modelos aprovados**.
- Cobrança **por mensagem entregue** desde 01/07/2025, por categoria e país. Mensagens de atendimento: 1.000 gratuitas
  por número por mês; acima disso, cobradas desde 01/10/2026. Valor de marketing para o Brasil: **a validar na tabela
  oficial** (não encontrei o número na página).
- **Conclusão:** disparo automático para empresas que nunca falaram com a AUDITA não é permitido e arrisca o número.
  O plano usa WhatsApp em três degraus (seção 6.5).

### 3.3 LGPD

- Dados de **pessoa jurídica** (razão social, CNPJ, CNAE, endereço e telefone comercial) não são dados pessoais. Mas
  **MEI, empresário individual e nomes/telefones de pessoas de contato são**.
- Base legal proposta para a prospecção B2B: **legítimo interesse**, com avaliação documentada, origem do dado registrada
  em cada lead, mensagem inicial que se identifica e oferece saída, **lista "não contatar"** respeitada em todos os
  canais e prazo de guarda para leads sem resposta.
- **A validar com advogado** antes de escalar (pergunta 9).

---

## 4. Visão do produto

**AUDITA PROSPECT** é o módulo de inteligência comercial do Sistema AUDITA de Operação. Em poucos passos o usuário:
**escolhe um nicho e uma região → vê as empresas no mapa e na lista → seleciona → o sistema qualifica e explica →
envia ao funil → o sistema lembra os retornos → o lead vira cliente, demanda e orçamento** sem redigitar nada.

Critérios de localização de empresas: segmento, nicho, palavras-chave, **CNAE**, cidade, estado, região, raio, **porte**
(o da Receita: MEI, microempresa, pequeno porte, demais) e potencial de contratação.

**Três níveis de confiança, sempre visíveis em cada informação:**
`Verificado` (base oficial da Receita, ou confirmado por você) · `Estimado` (hipótese do sistema, com a explicação) ·
`Não disponível` (o sistema não preenche).

---

## 5. Fontes de dados

| Fonte | O que traz | Pode guardar? | Custo | Papel |
|---|---|---|---|---|
| **Base pública de CNPJ (Receita Federal, dados abertos, mensal)** | Razão social, nome fantasia, CNAE principal e secundários, endereço, telefone e e-mail cadastrados, data de abertura, situação, porte, natureza jurídica | **Sim** | Gratuito | **Cadastro permanente do lead**, busca por CNAE/cidade/porte, empresas recém-abertas, IOC |
| **Google Places API (New)** | Descoberta por palavra-chave e raio; ao vivo: nome, endereço, telefone, site, nota, nº de avaliações, situação, link do Maps | Só `place_id` (e coordenadas por 30 dias) | Franquia mensal gratuita; depois por uso (seção 9) | **Descoberta, mapa e ficha ao vivo** |
| **Google Maps JavaScript** | Mapa interativo | — | Franquia mensal gratuita | Tela de mapa |
| **IBGE (malhas e códigos de municípios)** | Limites e centros de municípios | Sim | Gratuito | Mapa de calor por cidade, comparação de regiões |
| **Site da própria empresa** (aberto por você) | Contato comercial, WhatsApp publicado | O que você registrar | — | Validação manual de contato |
| **CRM do próprio AUDITA** | Contatos, respostas, reuniões, propostas, clientes | Sim | — | Histórico de conversão e aprendizado |

Observações: o layout da base da Receita (campos de telefone e e-mail no arquivo de estabelecimentos) **será conferido no
arquivo oficial na Fase 0**. O servidor da Receita é lento e instável; a carga é mensal, feita fora do horário de uso, e
guardamos **só o recorte** (estado/região e situação ativa) para caber na VPS. Telefone da Receita pode estar
desatualizado: entra como `Verificado na Receita em mm/aaaa`, não como "telefone confirmado".

**Ligação Google ↔ CNPJ:** o sistema sugere o CNPJ provável (nome parecido + mesma cidade/CEP) e **você confirma**.
Sem confirmação, o lead fica só com o `place_id` e os dados que você digitar.

---

## 6. Módulos do PROSPECT

### 6.1 Motor de pesquisa

- **Pesquisa por CNAE e região (base da Receita):** filtros por CNAE, cidade, bairro/CEP, porte, data de abertura e
  situação. Resultado guardável, ilimitado e gratuito. É a pesquisa principal para montar listas.
- **Pesquisa por palavra-chave no Google Maps:** palavra-chave + cidade ou raio (até 50 km por consulta). Várias
  palavras-chave de uma vez. Resultado na lista e no mapa, ao vivo.
- **Mapeamento automático de uma área:** o sistema divide a cidade em quadrículas e roda as palavras-chave do nicho em
  cada uma, guardando os `place_id`. Mostra **antes** quantas consultas vai gastar e quanto resta da cota do mês.
- **Biblioteca de palavras-chave e nichos** (6.2), pesquisas salvas, histórico de pesquisas com data, autor, filtros e
  quantidade de resultados.
- **Sem duplicidade:** uma empresa é única por CNPJ e por `place_id`; a pesquisa marca "já é lead", "já é cliente",
  "não contatar" e "ainda não prospectada".
- **Atualização:** a ficha ao vivo do Google é sempre atual; a base da Receita é renovada todo mês, e o sistema avisa o
  que mudou nos seus leads (situação, endereço, telefone).

Cada empresa mostra, conforme a fonte e a disponibilidade: nome, segmento/CNAE, endereço, cidade/UF, telefone comercial,
site, link do Google Maps, nota e nº de avaliações, situação de funcionamento, contatos publicados e WhatsApp comercial
**somente quando validado** (publicado pela própria empresa ou confirmado por você).

### 6.2 Biblioteca de palavras-chave e nichos

- Grupos temáticos editáveis, já carregados com os exemplos do pedido: **SSMA** (segurança do trabalho, saúde
  ocupacional, engenharia de segurança, gestão de riscos, consultoria em SST, treinamentos NR, PGR, GRO, PCMSO), **SGI**
  (ISO 9001, ISO 14001, ISO 45001, sistema de gestão integrada, gestão da qualidade, gestão ambiental, auditoria interna,
  consultoria ISO) e **Segmentos** (indústria, metalurgia, construção civil, transporte, logística, alimentos, química,
  engenharia).
- Atenção de estratégia: palavras de SSMA/SGI encontram **concorrentes e parceiros** (outras consultorias); palavras de
  **segmento** encontram **clientes**. A biblioteca marca cada grupo como "clientes", "parceiros" ou "concorrentes".
- Cada nicho liga palavras-chave ↔ CNAEs ↔ **serviços liberados do catálogo AUDITA** (só os aptos comercialmente).
- Criar, editar, inativar (sem exclusão física), combinar, salvar pesquisas, rodar em lote e montar **campanhas** por nicho.

### 6.3 Inteligência geográfica e IOC

- **Mapa interativo** com as empresas, agrupamento por proximidade, filtros por nicho e situação no funil.
- **Mapa de calor por cidade e por bairro/CEP** com dados da Receita: concentração por segmento, polos e distritos
  industriais (identificados pela concentração de CNAEs industriais por CEP), comparação entre regiões e **áreas ainda
  não trabalhadas** (muitas empresas-alvo, poucos leads).
- **Sugestão de roteiro:** empresas próximas entre si para visitas no mesmo dia (Routes API só se for preciso; no MVP,
  agrupamento por bairro).

**Índice de Oportunidade Comercial (IOC), de 0 a 100, por cidade/bairro e por nicho.** Fórmula aberta e ajustável em
Configurações; pesos iniciais **propostos, a calibrar**:

| Critério | Fonte | Peso inicial |
|---|---|---|
| Quantidade de empresas-alvo ativas | Receita | 30 |
| Concentração de segmentos prioritários | Receita + biblioteca de nichos | 20 |
| Compatibilidade com serviços liberados da AUDITA | Catálogo | 20 |
| Disponibilidade de canal de contato (telefone/e-mail cadastrados) | Receita | 10 |
| Distância/deslocamento a partir de Sorocaba | IBGE | 10 |
| Histórico de conversão na região | CRM (só quando houver volume mínimo) | 10 |

Cada região mostra a nota **e a conta** (quanto cada critério contribuiu). Enquanto não houver histórico de conversão,
esse critério fica "sem dados" e o peso é redistribuído; o sistema não inventa histórico.

### 6.4 Qualificação de leads

Pontuação de 0 a 100, **por regras explicáveis** (sem IA no MVP, custo zero):

| Critério | Exemplo de regra |
|---|---|
| Aderência do CNAE/segmento ao portfólio liberado | CNAE industrial ou de construção ↔ treinamentos por NR e consultoria de SST |
| Porte | Micro e pequeno porte = público prioritário do AUDDOC005 |
| Tempo de atividade | Empresa recém-aberta = provável necessidade de estruturar SST |
| Canal de contato disponível | Telefone e/ou e-mail cadastrados |
| Proximidade | Dentro do raio de atendimento |
| Situação | Ativa; não está em "não contatar"; não é cliente |

Classificação: **Prioritário · Alto potencial · Potencial intermediário · Baixo potencial**. Cada lead traz a explicação
("por que esta nota") e a lista de **serviços sugeridos**, sempre escrita como **hipótese** ("empresas deste segmento
costumam precisar de…"), nunca como necessidade confirmada. Você pode corrigir a nota; a correção fica registrada.

### 6.5 Contato: WhatsApp, e-mail e telefone

| Degrau | O que faz | Quando |
|---|---|---|
| **1. WhatsApp assistido** | Botão abre a conversa (link oficial "clique para conversar") com a mensagem do modelo já escrita e personalizada; **você revisa e envia**; o sistema registra o contato e agenda o retorno. Um a um, sem disparo | MVP |
| **2. E-mail comercial** | Envio individual pelo Brevo (já contratado), com modelo por segmento, identificação da AUDITA, origem do dado e link "não quero receber". Resposta registrada | Fase 2 |
| **3. WhatsApp API oficial** | Recebimento das respostas dentro do sistema, histórico da conversa, modelos aprovados para **quem autorizou** (respondeu, pediu contato pelo site, aceitou na reunião), lembretes | Fase 3, após validar número, custos e regras |

Em todos: modelos por segmento e por serviço, registro de cada contato, controle de respostas, lembretes automáticos de
retorno, lista de interessados e **lista "não contatar"** que bloqueia qualquer novo envio.
Telefone: roteiro de ligação na tela e registro do resultado em um clique.

### 6.6 CRM de prospecção

**Quadro em colunas** com as etapas: 1 Empresa identificada · 2 Lead importado · 3 Lead qualificado · 4 Primeiro contato
realizado · 5 Aguardando retorno · 6 Em negociação · 7 Reunião agendada · 8 Proposta enviada · 9 Cliente conquistado ·
10 Perdido ou desqualificado (com motivo obrigatório).

- Cadastro e edição de leads, responsável por lead, atividades, anotações, agendamento de retorno, alertas, histórico
  completo, filtros avançados, **leads sem movimentação há N dias**.
- **Integração sem duplicar cadastro:**
  - "Converter em cliente" cria o registro em Clientes com os dados do lead (confere antes por CNPJ se já existe).
  - "Abrir demanda" e "Gerar orçamento" usam o fluxo atual; quando o orçamento é emitido, o lead vai sozinho para
    **Proposta enviada**; quando é aceito, para **Cliente conquistado**.
  - O aviso de 48 h de "aguardando cliente" e os alertas do Início passam a incluir os leads.

### 6.7 Automação

Pesquisas programadas por nicho e por região · monitoramento de **empresas recém-abertas** nos CNAEs-alvo a cada carga
mensal da Receita · detecção de duplicados · qualificação e priorização automáticas · **"próximos contatos do dia"** ·
listas comerciais geradas por campanha · relatório semanal automático · alertas de novas oportunidades · recomendação de
novas regiões pelo IOC. Tudo com **teto de consumo** das APIs e registro do que rodou.

### 6.8 Inteligência artificial (opcional, só com sua aprovação de custo)

Usos previstos: sugerir abordagem e mensagem inicial personalizada, recomendar treinamentos e consultorias por perfil,
resumir o perfil da empresa. **Não é necessária para o MVP** (a qualificação é por regras).

Preços de tabela da API da Anthropic (referência de 03/11/2026, cobrados à parte da assinatura do Claude):

| Modelo | Entrada (US$ por milhão de tokens) | Saída | Estimativa por lead* |
|---|---|---|---|
| Claude Opus 5.5 | 4,00 | 20,00 | ≈ US$ 0,016 |
| Claude Sonnet 5.5 | 2,00 | 10,00 | ≈ US$ 0,008 |
| Claude Haiku 5.5 | 0,10 | 0,50 | ≈ US$ 0,0004 |

\* Premissa minha: ~1.500 tokens de entrada e ~500 de saída por lead (perfil + mensagem). É estimativa, não medição.
Processamento em lote tem 50% de desconto. Se aprovada, a IA entra com teto mensal, contador de gasto na tela e botão
"gerar" por lead (nada em massa sem pedido). A IA recebe dados da empresa, nunca dados de clientes.

### 6.9 Painel executivo

Indicadores: empresas identificadas · leads cadastrados · qualificados · prioritários · por segmento · por cidade · por
região · pesquisas realizadas · contatos efetuados · respostas · reuniões · propostas · clientes conquistados · taxa de
conversão por etapa, por nicho e por canal · regiões com maior IOC · serviços com maior demanda identificada · **consumo
e custo das APIs no mês**. Gráficos, mapa, filtros por período e exportação (CSV e PDF).

---

## 7. Arquitetura técnica

| Tema | Decisão proposta |
|---|---|
| Onde fica | Mesmo app Next.js, rotas `/prospeccao/*`; item "Prospecção" no menu (administrador e operador; nível "comercial" pode ser criado depois) |
| Chamadas ao Google | Só pelo servidor (Places, Geocoding), com chave restrita ao IP da VPS e às APIs usadas, guardada no `.env` do servidor. O mapa usa uma **segunda chave**, pública por natureza, restrita ao domínio `audita.seg.br` e somente à API de mapas |
| Controle de custo | Tabela de consumo por API e por mês; **teto configurável**; ao atingir, as pesquisas no Google param e a pesquisa pela Receita continua. Cotas diárias também limitadas no painel do Google. Máscara de campos mínima em cada chamada (paga-se pelo campo mais caro pedido) |
| Dados do Google | Guardar só `place_id`, datas e vínculo com o lead; coordenadas com validade de 30 dias; nome/telefone/site exibidos ao vivo na ficha, com a marca do Google |
| Base de CNPJ | Tabelas próprias (`cnpj_*`) com o recorte regional; carga mensal por rotina do servidor; índices por CNAE, município, CEP e data de abertura |
| Rotinas agendadas | Cron do servidor chamando rotinas internas protegidas (ou `pg_cron`, se disponível); cada execução registrada |
| E-mail | Brevo, pelo servidor; domínio com SPF/DKIM; descadastro por link |
| WhatsApp API (Fase 3) | Webhook em função de borda; token no servidor; modelos aprovados |
| Segurança | RLS em todas as tabelas novas; ações sensíveis na trilha de auditoria; inativação lógica; nada para `anon` |
| Backup | As tabelas novas entram no backup diário existente; a base de CNPJ fica fora do backup (é recarregável) para não inflar |
| Escalabilidade | Pesquisas paginadas no servidor; mapa com agrupamento; possibilidade futura de separar a base de CNPJ em outro banco sem mudar as telas |
| Documentação | Requisitos do módulo em novo documento controlado (**AUDDOC020 — Especificação do AUDITA PROSPECT**, rascunho preparado por mim para sua aprovação), já que a referência oficial hoje é o AUDDOC017 |

**Tabelas previstas (schema `audita`):** `prospect_keyword_groups`, `prospect_keywords`, `prospect_niches`,
`prospect_searches`, `prospect_search_runs`, `prospect_places` (só `place_id` e validade das coordenadas),
`cnpj_establishments`, `cnpj_companies`, `prospect_regions` (IOC por cidade/bairro/nicho), `leads`, `lead_contacts`,
`lead_activities`, `lead_stage_history`, `prospect_campaigns`, `message_templates`, `contact_suppressions`
("não contatar"), `api_usage`.

---

## 8. Experiência de uso

Fluxo principal em **4 passos**: (1) escolher nicho e região → (2) ver lista + mapa lado a lado → (3) marcar empresas e
clicar "Enviar ao funil" → (4) trabalhar o quadro: abrir o lead, um clique para WhatsApp/ligar/e-mail, registrar,
agendar retorno.

Telas: Painel · Pesquisar (lista + mapa) · Regiões (IOC) · Funil (quadro) · Lead (ficha com linha do tempo e ficha ao
vivo do Google) · Campanhas · Palavras-chave e nichos · Modelos de mensagem · Não contatar · Configurações (pesos, tetos).
Tudo no padrão visual do AUDDOC003, em pt-BR, funcionando no celular (o funil e o registro de contato são os mais usados
em campo).

---

## 9. Custos de APIs (fontes oficiais, consulta em 14/11/2026)

**Google Maps Platform** — franquia mensal gratuita por tipo de chamada e preço da primeira faixa paga:

| Chamada | Para que usamos | Grátis por mês | Depois (US$ por 1.000) |
|---|---|---|---|
| Text Search Essentials (só IDs) | Mapeamento automático (só `place_id`) | Sem limite | — |
| Text Search Pro | Pesquisa com nome, endereço, tipo e situação | 5.000 | 32,00 |
| Text Search Enterprise | Pesquisa já com telefone, site e nota | 1.000 | 35,00 |
| Place Details Essentials | Endereço e coordenadas de um lugar | 10.000 | 5,00 |
| Place Details Enterprise | **Ficha ao vivo** (telefone, site, nota) | 1.000 | 20,00 |
| Geocoding | Converter endereço em ponto no mapa | 10.000 | 5,00 |
| Dynamic Maps | Abrir o mapa na tela | 10.000 | 7,00 |

Leitura prática: cada página de pesquisa traz até 20 empresas, então **5.000 pesquisas gratuitas ≈ até 100 mil
resultados por mês**; a ficha ao vivo com telefone tem **1.000 aberturas gratuitas por mês**. Para um operador, isso
tende a caber na franquia. **A validar:** os valores acima na sua conta (o Google exige conta de faturamento com cartão
mesmo para a franquia); se ainda existe algum crédito mensal (a página consultada não menciona); impostos e câmbio.

**WhatsApp:** degrau 1 (assistido) não tem custo de API. Degrau 3: cobrança por mensagem; valores do Brasil **a validar**
na tabela oficial da Meta antes de decidir.
**E-mail (Brevo):** depende do plano já contratado; limite diário **a conferir** na sua conta.
**Receita Federal e IBGE:** gratuitos. **IA:** seção 6.8. **Infra:** sem servidor novo, salvo se o disco não comportar o
recorte de CNPJ (verifico na Fase 0).

---

## 10. Fases de implementação

| Fase | Entregas | Depende de |
|---|---|---|
| **0 — Preparação** | Suas respostas (seção 14); conta Google com teto; conferência do layout da Receita e do espaço em disco; auditoria das 41 telas; AUDDOC020 em rascunho; protótipo navegável das telas do PROSPECT para você aprovar | Você |
| **1 — MVP "primeiros clientes"** | Base de CNPJ da região; pesquisa por CNAE/cidade/porte; pesquisa por palavra-chave no Google com lista + mapa; biblioteca de nichos; sem duplicidade; qualificação por regras; funil em colunas; atividades e retornos; WhatsApp assistido; modelos de mensagem; "não contatar"; conversão em cliente/demanda; painel básico; teto de consumo | Fase 0 |
| **2 — Inteligência e escala** | IOC e mapa de calor; mapeamento automático por quadrículas; empresas recém-abertas; pesquisas programadas; campanhas; e-mail pelo Brevo; relatório semanal; painel executivo completo; Frente A (A2–A7) | Fase 1 em uso |
| **3 — Automação avançada** | WhatsApp API oficial (respostas no sistema, modelos para quem autorizou); IA para mensagens e recomendações; roteiros de visita; ajuste dos pesos com o histórico real; nível de acesso "comercial" | Decisões de custo e validação jurídica |

Em paralelo desde a Fase 1: componentes do sistema de design (A2), porque o PROSPECT precisa deles.
Cada fase termina com testes executados e evidência no `docs/HISTORICO.md`, e só vai ao servidor com a sua autorização.
**Prazo em semanas eu só informo depois das respostas da seção 14**, para não prometer data sem base.

---

## 11. Ideias além do pedido

| Funcionalidade | Benefício | Complexidade | Custo de API | Prioridade |
|---|---|---|---|---|
| Base pública de CNPJ como cadastro do lead | Dados guardáveis, CNAE, telefone, e-mail; resolve a restrição do Google | Média | Zero | **Essencial (Fase 1)** |
| Segmentação por CNAE e porte | Listas precisas por nicho | Baixa | Zero | **Essencial (Fase 1)** |
| Empresas recém-abertas por CNAE e cidade | Chegar antes da concorrência em quem está estruturando SST | Baixa | Zero | **Alta (Fase 2)** |
| Polos e distritos industriais por concentração de CEP | Roteiros e campanhas por polo | Média | Zero | Alta (Fase 2) |
| Sugestão de serviço por perfil (regras) | Abordagem certa para cada segmento | Baixa | Zero | **Alta (Fase 1)** |
| Lista "não contatar" e origem do dado em cada lead | Conformidade com LGPD e proteção do número | Baixa | Zero | **Essencial (Fase 1)** |
| Cadastro de cliente por CNPJ (reuso da base) | Menos digitação em todo o sistema | Baixa | Zero | Alta (Fase 2) |
| Integração lead → demanda → orçamento → proposta | Funil de ponta a ponta, sem redigitar | Média | Zero | **Essencial (Fase 1)** |
| Sequência de retornos (cadência por etapa) | Nenhum lead esquecido | Média | Zero | Alta (Fase 2) |
| Análise de campanhas (nicho × região × canal × modelo de mensagem) | Saber o que converte | Média | Zero | Alta (Fase 2) |
| Empresas com presença digital limitada (sem site no cadastro do Maps) | Abordagem consultiva diferente | Baixa | Dentro da franquia | Média (Fase 2) |
| Inteligência de mercado por setor (quantas empresas por CNAE e cidade, evolução mensal) | Decidir onde expandir | Média | Zero | Média (Fase 2) |
| Nichos pouco explorados (alto IOC × poucos leads) | Direcionar esforço | Baixa (após IOC) | Zero | Média (Fase 2) |
| Página de captação no site com autorização de contato | Gera opt-in legítimo para o WhatsApp API e leads de entrada | Média | Zero | Alta (Fase 2) |
| Roteiro de visitas do dia | Mais visitas por saída | Média | Routes API, a validar | Média (Fase 3) |
| IA para mensagens e recomendações | Personalização em escala | Média | Por uso (6.8) | Opcional (Fase 3) |
| WhatsApp API oficial | Conversa e histórico dentro do sistema | Alta | Por mensagem, a validar | Fase 3 |

**O que não proponho, por ser inviável ou arriscado:** extrair dados do Maps em massa ou por robô; disparo de WhatsApp
para listas frias; números de WhatsApp "descobertos" por tentativa; compra de listas de contatos sem origem conhecida.

---

## 12. Estratégia para os primeiros clientes

**Ponto de partida (hipóteses a confirmar com você):** público do AUDDOC005 (pequenas e médias empresas operacionais do
estado de SP, a partir de Sorocaba); oferta de entrada = **treinamentos por NR e consultoria de SST já liberados** no
catálogo; uma pessoa prospectando.

1. **Escolher 3 nichos de entrada** em que um treinamento resolve uma obrigação concreta. Sugestão para discutir:
   construção civil e manutenção (trabalho em altura, NR-35), logística/transportadoras/atacados (empilhadeira, NR-11) e
   indústrias de pequeno porte (integração, EPI, CIPA). São hipóteses de aderência, não demanda confirmada.
2. **Mapear Sorocaba e cidades vizinhas** por CNAE desses nichos e ordenar pelos bairros/polos de maior IOC.
3. **Oferta de entrada simples:** um treinamento com data, carga horária e condição clara, e um diagnóstico inicial de
   SST como porta para a consultoria recorrente. Preços saem do orçamento do próprio sistema (AUDDOC011).
4. **Cadência por lead (proposta):** dia 1 ligação ou WhatsApp assistido → dia 3 e-mail com a oferta → dia 7 retorno →
   dia 14 último contato → encerra como "sem resposta" (pode voltar em 90 dias). Quem pedir para não ser contatado sai
   na hora.
5. **Usar o sistema que já existe para fechar:** reunião → demanda → orçamento → proposta → aceite.

**Rotina semanal proposta**

| Dia | Atividade |
|---|---|
| Segunda | Planejar: escolher nicho + região da semana pelo IOC; gerar a lista; revisar os prioritários |
| Terça a quinta | Blocos diários de contato (primeiros contatos pela manhã, retornos à tarde); reuniões |
| Sexta | Retornos pendentes, propostas, revisão dos números da semana e ajuste de mensagens e nichos |

**Indicadores de produtividade e metas iniciais (propostas minhas para calibrar após 4 semanas; não são previsão de
resultado):**

| Indicador | Meta inicial por semana |
|---|---|
| Empresas novas mapeadas | 100 |
| Leads qualificados (prioritário + alto potencial) | 40 |
| Primeiros contatos realizados | 25 |
| Conversas efetivas (alguém respondeu/atendeu) | 8 |
| Reuniões agendadas | 2 |
| Propostas enviadas | 1 |
| Leads parados há mais de 7 dias sem próxima ação | 0 |

Meta de marco: **primeiro contrato em até 60 dias de uso do MVP**. As taxas reais de cada etapa vão aparecer no painel
e substituem estas hipóteses.

---

## 13. Riscos e cuidados

| Risco | Como tratamos |
|---|---|
| Violar os termos do Google guardando dados do Maps | Guardar só `place_id`; ficha ao vivo; cadastro pela Receita; revisão dos termos antes da Fase 1 |
| Bloqueio do número de WhatsApp | Sem disparo; envio manual um a um; "não contatar"; API só para quem autorizou |
| LGPD (MEI e pessoas de contato) | Legítimo interesse documentado, origem do dado, saída fácil, prazo de guarda, validação jurídica |
| Custo de API fora do previsto | Teto no sistema e no painel do Google, contador visível, máscara mínima de campos |
| Telefone/e-mail desatualizados na Receita | Rótulo com a data da fonte; confirmação pelo usuário; ficha ao vivo do Google como segunda checagem |
| Base da Receita pesada e instável para baixar | Recorte regional, carga mensal fora do horário, retomada automática |
| Módulo grande demais antes do primeiro resultado | MVP enxuto (Fase 1) e uso real antes da Fase 2 |
| Sistema atual afetado | Só acréscimos; testes; publicação com sua autorização; retorno à versão anterior preparado |

---

## 14. Perguntas indispensáveis antes de fechar o planejamento

1. **Conta Google Cloud:** você já tem uma conta com faturamento (cartão)? Posso orientar a criação. Qual teto mensal
   você aceita? (Sugestão: travar em US$ 0, ou seja, parar ao fim da franquia.)
2. **Região inicial:** Sorocaba e quais cidades ou raio? Atende só presencial ou também on-line para outras regiões?
3. **Nichos de entrada:** quais 3 segmentos você quer atacar primeiro? (Sugestões no item 12.)
4. **WhatsApp:** o número da empresa hoje usa o aplicativo WhatsApp Business? Aceita começar pelo envio assistido (um
   clique, você envia) e deixar a API oficial para a Fase 3? Existe um segundo número para a API?
5. **E-mail:** usamos o Brevo? Existe um endereço comercial no domínio (por exemplo, `comercial@audita.seg.br`)?
6. **Quem vai prospectar:** só você, ou haverá outra pessoa? (Define responsáveis, distribuição e nível de acesso.)
7. **IA:** começamos sem IA (custo zero) ou você quer aprovar um teto mensal desde o MVP? Qual valor?
8. **Base de CNPJ:** autoriza baixar a base pública da Receita e manter no servidor o recorte da região?
9. **Jurídico:** há um advogado para validar a prospecção (LGPD e termos do Google/Meta)? Enquanto não houver, sigo o
   desenho conservador deste documento.
10. **Prioridade:** confirma a ordem recomendada (MVP do PROSPECT primeiro, melhorias de tela em paralelo)?
11. **Oferta:** qual é a oferta de entrada (qual treinamento ou serviço, formato e condição) que as mensagens devem
    apresentar?

---

## 15. Fontes consultadas (14/11/2026)

- Google Maps Platform — preços: https://developers.google.com/maps/billing-and-pricing/pricing
- Google Places API — políticas de uso, cache e atribuição: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Places API — campos por faixa de preço: https://developers.google.com/maps/documentation/places/web-service/data-fields
- Google Places API — Text Search (limites e parâmetros): https://developers.google.com/maps/documentation/places/web-service/text-search
- WhatsApp Business Platform — preços: https://developers.facebook.com/docs/whatsapp/pricing
- WhatsApp Business Platform — opt-in: https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in
- Receita Federal — dados abertos do CNPJ (arquivos mensais): https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/ (layout a conferir na Fase 0)
- Anthropic — preços da API do Claude: tabela de referência de 03/11/2026 (confirmar na página oficial antes de contratar)

---

## 16. Decisões do Diretor em 14/11/2026 e ajustes no plano

| # | Resposta do Diretor | Efeito no plano |
|---|---|---|
| 1 | Não tem Google Cloud; teto mensal R$ 0,00 | **Fase 1 sem nenhuma API paga e sem cartão:** base de CNPJ + mapa aberto (OpenStreetMap) + botão "Ver no Google Maps" em cada empresa (abre o Maps em outra aba, sem API). A pesquisa por palavra-chave dentro do sistema (Google Places) fica como **opcional da Fase 2**: exige conta Google com cartão cadastrado, mesmo sem cobrança; se for ativada, as cotas são travadas na franquia gratuita |
| 2 | Somente Estado de São Paulo; atende on-line também | Recorte da base de CNPJ = SP, estabelecimentos ativos. Presencial priorizado por distância de Sorocaba; on-line/EAD para todo o estado |
| 3 | Sem preferência de nichos | Os 3 nichos de entrada serão **propostos com base nos dados** (quantidade de empresas por CNAE em SP × aderência aos serviços liberados), para aprovação |
| 4 | Usa WhatsApp Business; aceita envio assistido; não tem segundo número | WhatsApp assistido no MVP; API oficial fica fora do horizonte até existir um segundo número |
| 5 | Só `engenharia.audita@outlook.com` | E-mail de prospecção em escala não é viável com endereço @outlook.com. Proposta para a Fase 2 (custo zero, a confirmar): endereço no domínio `audita.seg.br` com encaminhamento para o Outlook e envio pelo Brevo. No MVP, o sistema abre o seu programa de e-mail com a mensagem pronta |
| 6 | Diretor + 1 usuário | Responsável por lead e distribuição simples entre dois usuários desde o MVP |
| 7 | Sem IA; custo zero | Qualificação e mensagens por regras e modelos; IA retirada das fases |
| 8 | Autoriza a base pública de CNPJ no servidor | Carga mensal do recorte de SP |
| 9 | Tem advogado para validar | Antes de escalar os contatos, enviar a ele a seção 3 (LGPD e termos) |
| 10 | Confirma a ordem | MVP do PROSPECT primeiro; melhorias de tela em paralelo |
| 11 | Pede sugestão; carros-chefe: PGR, treinamentos normativos, consultoria de SST | Ver "Oferta de entrada" abaixo |

**Conferido no servidor (14/11/2026, somente leitura):** disco com 64 GB livres de 96 GB e banco do AUDITA com 25 MB
(há espaço para o recorte de SP; o tamanho exato sai da primeira carga); `pg_cron` não está instalado (as rotinas usam o
cron do servidor); `pg_trgm` e `unaccent` já instalados (busca por nome parecido e sem acento).

**Oferta de entrada (sugestão, usando só serviços liberados no catálogo):**

1. **Diagnóstico inicial de SST** (SST-002 Inspeção + SST-009 Relatório técnico): visita ou reunião on-line, relatório
   com os pontos de atenção. É a porta de entrada: mostra o problema e abre as duas ofertas seguintes.
2. **PGR**: no catálogo o serviço liberado é **DOC-001 — Apoio à estruturação e manutenção do PGR/GRO** (a
   responsabilidade pelo PGR é da organização, conforme a NR-1; avaliações especializadas estão fora). As mensagens
   devem dizer "apoio à estruturação/elaboração e manutenção do PGR", não prometer laudos. Se a AUDITA quiser vender
   "elaboração de PGR" com outro escopo, é decisão sua no catálogo antes de anunciar.
3. **Treinamentos normativos**: presenciais na empresa (ofertas TRN-NR liberadas, como NR-35, NR-11, NR-06, NR-05,
   NR-20 e NR-33 com as condições registradas) e **EAD para todo o estado** (cursos L01 a L08 cadastrados; publicar e
   precificar os que forem entrar na oferta).
4. **Consultoria recorrente de SST** (SST-001) como continuidade para quem fechou diagnóstico, PGR ou treinamento.

Preços e condições saem do orçamento do próprio sistema (AUDDOC011); este documento não fixa valores.

**A conferir na Fase 0 por causa do custo zero:** forma gratuita de posicionar as empresas no mapa a partir do endereço
ou CEP da Receita (sem a API do Google) e regras de uso do mapa aberto para o nosso volume. Enquanto isso não for
confirmado, o mapa trabalha por cidade e bairro (IBGE), o que já atende o IOC e a escolha de regiões.

---

## 17. Resultado da Fase 0 (14/11/2026)

**Base de CNPJ.** A Receita mudou o endereço de publicação em 2026; os arquivos estão no repositório público
`arquivos.receitafederal.gov.br` (pasta Dados › Cadastros › CNPJ, uma pasta por mês). Publicação usada: **2026-10**
(arquivos de 13/10/2026). Layout conferido nos próprios arquivos: estabelecimentos com 30 colunas, incluindo DDD/telefone 1 e 2
e e-mail. O servidor da Receita limita cada conexão a ~0,5 MB/s; com 6 conexões em paralelo os 6,4 GB (estabelecimentos,
empresas e tabelas) baixaram em ~1 h. Recorte de SP gravado no servidor: `/home/deploy/audita/cnpj/2026-10/sp/`
(540 MB compactado), fora do backup.

**Números do Estado de São Paulo (estabelecimentos ativos):** 8.833.181, de 8.403.368 empresas; 4.979.836 são de
empresário individual/MEI. Quase todos têm telefone (8,64 mi) ou e-mail (8,16 mi) no cadastro, **mas esse contato
costuma ser do contador que abriu a empresa**: a abordagem precisa confirmar o contato (ficha ao vivo, site da empresa ou
ligação) antes de tratá-lo como contato da empresa.

**Nichos de entrada propostos** (empresa-alvo = ativa, não é MEI/empresário individual, porte ME, EPP ou demais;
contagens reais da base de 10/2026):

| Nicho | Até 50 km de Sorocaba | Até 100 km | Estado | Abertas nos últimos 12 meses (Estado) | Por que |
|---|---|---|---|---|---|
| **Construção civil** (CNAE 41, 42, 43) | 9.449 | 109.128 | 164.633 | 17.082 | Atividade de alto risco; NR-35, PGR, inspeção e consultoria liberados |
| **Atacado, armazenagem e transporte** (46, 52, 4930) | 10.494 | 139.572 | 226.834 | 24.810 | Empilhadeira (NR-11), altura (NR-35), incêndio (NR-23), PGR |
| **Indústria de pequeno porte** (10–11, 13–18, 20–25, 28–31) | 7.556 | 68.241 | 118.165 | 8.552 | NR-11 (ponte rolante), NR-06, NR-20, NR-26, PGR, OS de SST |

Ficaram fora da entrada: saúde (precisa da NR-32, que não está no catálogo), agropecuária (NR-31 fora do catálogo e
cadastros rurais distorcem o porte), limpeza/facilities (inclui condomínios) e restaurantes (baixa aderência).

**Regiões (IOC até 60 km de Sorocaba, três nichos somados):** Sorocaba 74 (9.155 empresas-alvo), Barueri 73 (7.387),
Santana de Parnaíba 71 (2.843), Indaiatuba 70 (4.075), Araçariguama 70 (390), Vargem Grande Paulista 69 (912),
Cotia 67 (3.741), Itupeva 66 (1.091), Boituva, Itu e Salto 65. Fórmula do protótipo: quantidade (30, escala
logarítmica), concentração nos nichos (20) e distância (10), normalizados para 100; canal de contato e histórico entram
na versão real. Municípios: IBGE (645 de SP, todos casados com o código da Receita).

**Mapa e localização sem custo (regras conferidas):** OpenStreetMap permite uso leve com atribuição visível, sem baixar
ou pré-carregar áreas; o Nominatim permite no máximo 1 consulta por segundo e proíbe localização em massa ou sistemática.
Por isso o mapa da Fase 1 trabalha por município (malha do IBGE) e a empresa só é localizada individualmente quando a
ficha é aberta, com o resultado guardado.

**Protótipo navegável (7 telas):** https://claude.ai/artifact/62EkNAtmLqMPBxyWk5LgLL — painel, pesquisa, regiões (números
reais), funil, ficha do lead, nichos (números reais) e registro de contato no celular. Empresas das listas são fictícias.

**AUDDOC020 Rev.00** (Especificação de Requisitos do AUDITA PROSPECT): registrada na Biblioteca como rascunho para
aprovação.

**Auditoria das telas: pendente.** O ambiente de testes em nuvem (`audita-dev`, pendência V4) está desligado e as contas
de teste não entram; o Docker Desktop do computador do Diretor não inicia (instalação incompleta: falta a chave
`HKLM\SOFTWARE\Docker Inc.\Docker Desktop` no registro). Assim que o Docker for reinstalado, o ambiente de testes local é
montado e as 41 telas são capturadas em computador e celular (roteiro pronto).
