/**
 * AUDDOC020 — Especificação de Requisitos do AUDITA PROSPECT, Rev.01 (rascunho para aprovação do Diretor).
 * Gerada a partir da Rev.00 vigente (scripts/biblioteca/auddoc020-rev00.ts), alterando só o que as decisões do
 * Diretor de 19/11/2026 mudaram (docs/PLANEJAMENTO_PROSPECCAO_V2.md, seções 6 e 7). O resto é idêntico à Rev.00.
 * Uso: npx vite-node --config vitest.config.ts scripts/biblioteca/auddoc020-rev01.ts <pasta de saída>
 */
import fs from "node:fs";
import path from "node:path";
import { renderDocx } from "@/lib/documents/render-docx";
import type { Block } from "@/lib/documents/proposal";

const CODE = "AUDDOC020";
const TITLE = "Especificação de Requisitos do AUDITA PROSPECT";
const REV = "Rev.01";
const REV_ANT = "Rev.00";
const TODAY = "19/11/2026";

const t = (headers: string[], widths: number[], rows: string[][]): Block => ({
  kind: "table",
  headers,
  widths,
  align: headers.map(() => "left" as const),
  rows,
  totals: [],
});
const p = (text: string): Block => ({ kind: "paragraph", text });
const h = (text: string): Block => ({ kind: "heading", text });

const blocks: Block[] = [
  {
    kind: "fields",
    rows: [
      ["Código", CODE],
      ["Título", TITLE],
      ["Revisão", `${REV} — Prospecção 2.0 (substitui a ${REV_ANT} de 14/11/2026)`],
      ["Situação", "Rascunho para aprovação do Diretor"],
      ["Aprovação desta revisão", "Vinicius Rocha Pereira — Diretor, conforme registro de publicação na Biblioteca do Sistema AUDITA"],
      ["Documentos relacionados", "AUDDOC017 (requisitos do Sistema AUDITA de Operação), AUDDOC003 (identidade visual), AUDDOC004/005 (serviços), AUDDOC011 (precificação), AUDDOC013 (registros e documentos)"],
      ["Base", "Planejamento de 14/11/2026 aprovado pelo Diretor e planejamento da Prospecção 2.0 com as decisões do Diretor de 19/11/2026"],
      ["Elaboração", `Elaboração assistida (Claude), em ${TODAY}`],
    ],
  },
  h("1. Objetivo e escopo"),
  p("O AUDITA PROSPECT é o módulo de inteligência comercial do Sistema AUDITA de Operação. Seu objetivo é encontrar empresas com potencial de contratação dos serviços liberados da AUDITA no Estado de São Paulo, qualificá-las de forma explicável, organizar o contato comercial e converter oportunidades em clientes, demandas e orçamentos, sem redigitação."),
  p("Fora do escopo desta revisão: disparo automático de mensagens de WhatsApp, uso de inteligência artificial paga, APIs pagas do Google e a API oficial do WhatsApp (dependem de decisão futura do Diretor)."),
  h("2. Decisões e premissas aprovadas (14/11/2026, revisadas em 19/11/2026)"),
  t(["Tema", "Decisão"], [28, 72], [
    ["Custo de APIs", "Teto de R$ 0,00 por mês. Nenhuma API paga e nenhuma conta com cartão. O envio de e-mail usa o plano gratuito do Brevo."],
    ["Região", "Somente o Estado de São Paulo. Atendimento presencial priorizado por distância de Sorocaba; on-line/EAD para todo o estado. Médias e grandes empresas com prioridade até 150 km de Sorocaba."],
    ["Público-alvo (19/11/2026)", "Prioridade para empresas de pequeno porte, médias e grandes. Grande: S.A., 3 ou mais filiais ou capital social a partir de R$ 5 milhões; média: capital social a partir de R$ 1 milhão. Microempresa só com sinal de estrutura (capital social a partir de R$ 100 mil ou filiais). Fora da prospecção automática: MEI/empresário individual, produtor rural pessoa física, associações e condomínios (continuam acessíveis na pesquisa avulsa)."],
    ["Inteligência artificial", "Não utilizada. Qualificação e mensagens por regras e modelos."],
    ["WhatsApp", "Envio assistido (o usuário revisa e envia pelo WhatsApp Business da empresa, (15) 99689-1049). Para vários leads, fila de envio assistida: o sistema abre uma conversa por vez com a mensagem pronta e registra o contato. Sem segundo número; sem API oficial; sem disparo automático."],
    ["E-mail (19/11/2026)", "E-mail de apresentação em HTML enviado pelo sistema, por conta Brevo separada da usada nos e-mails de acesso, com remetente do domínio audita.seg.br autenticado e respostas encaminhadas ao e-mail da empresa. Individual ou em lote, com descadastro e limite diário (início em 30 e até 100 por dia, com pausa automática se as devoluções passarem de 3%). O envio em lote só é liberado após a validação jurídica registrada."],
    ["Usuários", "Diretor e mais um usuário."],
    ["Meta de contatos", "20 contatos por dia útil, acompanhada no painel."],
    ["Base de CNPJ", "Autorizado manter no servidor o recorte de SP da base pública da Receita Federal, incluindo o capital social."],
    ["Validação jurídica", "Avaliação de legítimo interesse validada pelo advogado antes de ampliar os contatos (envio em lote); o sistema registra a data da validação."],
  ]),
  h("3. Fontes de dados e regras de uso"),
  t(["Fonte", "Uso permitido no sistema", "Restrição"], [24, 40, 36], [
    ["Receita Federal — dados abertos do CNPJ (mensal)", "Cadastro permanente do lead, pesquisa por CNAE, município, porte e data de abertura, contagens e índice de oportunidade", "Telefone e e-mail exibidos com a data da publicação; podem estar desatualizados"],
    ["IBGE — malhas e códigos de municípios", "Mapa por município, comparação de regiões", "—"],
    ["OpenStreetMap — mapa", "Exibição do mapa com atribuição visível", "Uso leve; proibido baixar ou pré-carregar áreas"],
    ["Nominatim (OpenStreetMap) — localização por endereço", "Localizar uma empresa quando o usuário abre a ficha, com resultado guardado", "Máximo de 1 consulta por segundo; proibido em massa ou sistemático"],
    ["Google Maps (link)", "Botão \"Ver no Google Maps\" abre a busca em outra aba", "Nada do Google é copiado ou guardado"],
    ["Registros do próprio sistema", "Contatos, respostas, reuniões, propostas e conversões", "—"],
    ["Brevo (plano gratuito) — envio de e-mail", "E-mail de apresentação e registro de entrega, devolução e descadastro", "Remetente do domínio autenticado (SPF, DKIM, DMARC); limite diário; chave guardada só no servidor"],
  ]),
  p("Cada informação exibida tem um de três níveis: Verificado (fonte oficial ou confirmado pelo usuário), Estimado (hipótese do sistema, com a explicação) ou Não disponível. O sistema não preenche dados ausentes."),
  h("4. Requisitos funcionais"),
  t(["Código", "Requisito", "Fase"], [12, 76, 12], [
    ["RP-01", "Importar mensalmente o recorte de SP (estabelecimentos ativos) da base pública de CNPJ, com registro da publicação usada e das diferenças em relação à anterior", "1"],
    ["RP-02", "Pesquisar empresas por CNAE (principal e secundário), município, bairro/CEP, porte, natureza jurídica, capital social, número de filiais, data de abertura e existência de telefone ou e-mail", "1"],
    ["RP-03", "Biblioteca de palavras-chave e nichos editável (criar, editar, inativar, agrupar), ligando nicho ↔ CNAEs ↔ serviços liberados do catálogo; carga inicial com os grupos SSMA, SGI e Segmentos", "1"],
    ["RP-04", "Salvar pesquisas, executar em lote e manter o histórico (data, usuário, filtros, quantidade de resultados)", "1"],
    ["RP-05", "Evitar duplicidade: empresa única por CNPJ; indicar se já é lead, cliente ou está em \"não contatar\"", "1"],
    ["RP-06", "Qualificar cada empresa de 0 a 100 por regras explicáveis (aderência do CNAE ao portfólio liberado, porte conforme o público-alvo da seção 2, tempo de atividade, canal de contato, proximidade, situação) e estimar a chance de resposta (contato próprio ou provável contato da contabilidade, quando o mesmo telefone ou e-mail se repete em 5 ou mais CNPJs; e-mail com domínio próprio). Classificar em Quentes, Mornos, Frios e Precisa de contato, com a explicação e os serviços sugeridos escritos como hipótese. A chance é estimativa por regras até haver histórico mínimo para calibrar", "1"],
    ["RP-07", "Funil comercial em colunas com as etapas: empresa identificada, lead importado, lead qualificado, primeiro contato realizado, aguardando retorno, em negociação, reunião agendada, proposta enviada, cliente conquistado, perdido ou desqualificado (motivo obrigatório)", "1"],
    ["RP-08", "Ficha do lead com dados da Receita, responsável, atividades, anotações, agendamento de retorno, histórico completo e alertas de leads sem movimentação", "1"],
    ["RP-09", "Contato assistido: WhatsApp (link oficial de conversa com a mensagem do modelo preenchida; para vários leads, fila de envio assistida), ligação (roteiro e registro do resultado) e e-mail de apresentação enviado pelo sistema (individual ou em lote, conforme a seção 2); cada contato registrado e retorno agendado", "1"],
    ["RP-10", "Modelos de mensagem por segmento e por serviço, com identificação da AUDITA e opção de saída. Mensagem padrão de WhatsApp definida pelo Diretor em 19/11/2026: \"Olá! Tudo bem? Aqui é [nome do usuário], da AUDITA | SSMA & SGI, de Sorocaba. 👋 Ajudamos [indústrias ou o segmento da empresa] a manter a Segurança do Trabalho e o Meio Ambiente em dia, com treinamentos normativos (NRs) e consultoria técnica. Posso entender rapidamente as necessidades da [nome da empresa] e ver como podemos apoiar?\" com a linha de saída \"Se não fizer sentido agora, é só me avisar que não entro mais em contato.\"", "1"],
    ["RP-11", "Lista \"não contatar\" que bloqueia qualquer novo contato pelo sistema, com data e motivo", "1"],
    ["RP-12", "Converter lead em cliente (com verificação por CNPJ), abrir demanda e gerar orçamento pelo fluxo atual; mudança automática de etapa ao emitir e ao aceitar a proposta", "1"],
    ["RP-13", "Painel com empresas identificadas, leads, qualificados, prioritários, contatos, respostas, reuniões, propostas, clientes e conversão por etapa, nicho e canal; exportação CSV", "1"],
    ["RP-14", "Índice de Oportunidade Comercial (IOC) por município e nicho, com pesos configuráveis e a contribuição de cada critério exibida; histórico de conversão só entra com volume mínimo", "2"],
    ["RP-15", "Mapa por município (IBGE) com concentração por nicho, polos identificados por concentração de CEP e áreas pouco trabalhadas", "2"],
    ["RP-16", "Empresas recém-abertas nos CNAEs-alvo a cada publicação mensal, com alerta", "2"],
    ["RP-17", "Campanhas por nicho e região, cadência de retornos por etapa e análise de desempenho (nicho × região × canal × modelo)", "2"],
    ["RP-18", "Cadastro de cliente a partir do CNPJ em todo o sistema, usando a base importada", "2"],
    ["RP-19", "Relatório semanal automático e sugestão de próximas regiões pelo IOC", "2"],
    ["RP-20", "Oportunidades do dia: carteira pré-calculada das empresas que atendem ao público-alvo, atualizada à noite e a cada carga da base, entregue já organizada por grupo (RP-06) sem que o usuário escolha segmento; exclui quem já é lead, cliente ou está em \"não contatar\"", "1"],
    ["RP-21", "Modo prospecção: uma empresa por tela (celular e computador), com o resumo da análise, botões de WhatsApp, ligação e e-mail com a mensagem pronta, registro do resultado em um toque e passagem para a próxima", "1"],
    ["RP-22", "Correção do contato do lead na própria ficha e marcação \"é da contabilidade\", que rebaixa automaticamente as demais empresas com o mesmo telefone ou e-mail", "1"],
    ["RP-23", "Painel de gestão em uma tela: meta diária de contatos, sequência de dias com meta cumprida, respostas, reuniões, propostas, clientes, taxa de resposta por grupo, canal, mensagem e segmento, e comparação entre a chance estimada e a resposta real", "1"],
  ]),
  h("5. Requisitos não funcionais"),
  t(["Código", "Requisito"], [12, 88], [
    ["RNF-P01", "Módulo nativo do Sistema AUDITA (mesma aplicação, autenticação, permissões e identidade visual do AUDDOC003); funciona em celular e computador"],
    ["RNF-P02", "Tabelas novas no schema audita, migrações somente aditivas, RLS e GRANT mínimo, nada para anon, trilha de auditoria nas ações sensíveis, inativação lógica"],
    ["RNF-P03", "Nenhuma chamada a serviço pago; consultas a serviços gratuitos respeitam os limites de uso e ficam registradas"],
    ["RNF-P04", "LGPD: origem do dado registrada em cada lead; base legal de legítimo interesse documentada e validada pelo advogado; prazo de guarda de 6 meses para leads sem resposta, depois anonimizados; dados de empresário individual e de pessoas de contato tratados como dados pessoais; descadastro por link em todo e-mail, com inclusão automática em \"não contatar\""],
    ["RNF-P05", "A base de CNPJ fica fora do backup diário (recarregável); as tabelas do funil entram no backup"],
    ["RNF-P06", "Pesquisa em até 3 segundos para filtros comuns no recorte de SP; lista de oportunidades do dia em até 1 segundo; aviso de carregamento imediato em todas as telas"],
  ]),
  h("6. Critérios de aceite da Fase 1"),
  p("6.1. Uma pesquisa por nicho e município retorna empresas ativas de SP com CNAE, porte, endereço e canais de contato, cada informação com o nível de confiança."),
  p("6.2. Empresas selecionadas entram no funil sem duplicar quem já é lead ou cliente, e quem está em \"não contatar\" não pode ser contatado."),
  p("6.3. O contato por WhatsApp, ligação ou e-mail fica registrado e gera o próximo retorno; o lead convertido vira cliente, demanda e orçamento sem redigitação."),
  p("6.4. Testes automatizados executados (unidade, banco e telas em celular e computador) e evidência registrada no docs/HISTORICO.md."),
  h("7. Controle de revisões"),
  t(["Revisão", "Data", "Responsável", "Descrição"], [12, 14, 28, 46], [
    [REV_ANT, "14/11/2026", "Vinicius Rocha Pereira — Diretor", "Emissão inicial a partir do planejamento aprovado em 14/11/2026. Elaboração assistida; aprovação registrada na Biblioteca do Sistema AUDITA."],
    [REV, TODAY, "Vinicius Rocha Pereira — Diretor", "Prospecção 2.0 (decisões de 19/11/2026): público-alvo por porte e capital social; chance de resposta e grupos (RP-06); fila de envio assistida no WhatsApp e e-mail de apresentação pelo Brevo (RP-09); mensagem padrão do WhatsApp (RP-10); novos RP-20 a RP-23; meta diária; guarda de 6 meses e descadastro (RNF-P04); tempos (RNF-P06). Demais itens sem alteração."],
  ]),
];

const buf = await renderDocx({
  templateCode: CODE,
  modelCode: "ESPEC",
  title: TITLE,
  reference: REV,
  headerRight: `${CODE} · ${TITLE} · ${REV}`,
  footer: `AUDITA · ${CODE} ${REV} · Aprovação registrada na Biblioteca do Sistema AUDITA`,
  watermark: null,
  fileBase: `${CODE}_Especificacao_AUDITA_PROSPECT_Rev01`,
  blocks,
});
const out = path.join(process.argv[2], `${CODE}_Especificacao_AUDITA_PROSPECT_Rev01.docx`);
fs.writeFileSync(out, buf);
console.log(out, buf.length);
