/**
 * Avaliação de Legítimo Interesse (LGPD art. 7º, IX, e art. 10) da prospecção comercial do AUDITA PROSPECT, para a
 * validação jurídica exigida pelo AUDDOC020 (RNF-P04, decisões de 19/11/2026). Documento de trabalho para o advogado da
 * AUDITA; não identifica o advogado (pedido do Diretor). Só descreve o que o sistema faz ou fará conforme o AUDDOC020.
 * Uso: npx vite-node --config vitest.config.ts scripts/juridico/avaliacao-legitimo-interesse.ts <pasta de saída>
 */
import fs from "node:fs";
import path from "node:path";
import { renderDocx } from "@/lib/documents/render-docx";
import type { Block } from "@/lib/documents/proposal";

const TITLE = "Avaliação de Legítimo Interesse — Prospecção Comercial";
const VERSAO = "Versão para validação jurídica — 19/11/2026";

const t = (headers: string[], widths: number[], rows: string[][]): Block => ({ kind: "table", headers, widths, align: headers.map(() => "left" as const), rows, totals: [] });
const p = (text: string): Block => ({ kind: "paragraph", text });
const h = (text: string): Block => ({ kind: "heading", text });

const blocks: Block[] = [
  {
    kind: "fields",
    rows: [
      ["Documento", TITLE],
      ["Situação", VERSAO],
      ["Controlador", "AUDITA | SSMA & SGI (dados cadastrais conforme os Dados institucionais do Sistema AUDITA)"],
      ["Tratamento avaliado", "Prospecção de empresas (pessoas jurídicas) para oferta de serviços de Segurança do Trabalho, Meio Ambiente e Sistemas de Gestão, pelo módulo AUDITA PROSPECT"],
      ["Referências", "LGPD (Lei 13.709/2018), arts. 6º, 7º, IX, 10, 18 e 37; Guia Orientativo da ANPD sobre a hipótese legal do legítimo interesse; AUDDOC020 (requisitos do AUDITA PROSPECT)"],
      ["Elaboração", "Elaboração assistida (Claude), a pedido do Diretor, para validação por advogado(a) da AUDITA"],
    ],
  },
  h("1. Contexto"),
  p("A AUDITA presta serviços de Segurança do Trabalho (treinamentos normativos — NRs — e consultoria técnica), Meio Ambiente e Sistemas de Gestão a empresas. Para encontrar empresas que possam precisar desses serviços, o Sistema AUDITA usa a base pública de CNPJ da Receita Federal (dados abertos), seleciona empresas cujo ramo de atividade (CNAE) tem relação com os serviços oferecidos e organiza um primeiro contato comercial por WhatsApp, telefone ou e-mail."),
  p("O público é exclusivamente de pessoas jurídicas. Empresários individuais e MEI são excluídos desde a carga da base. Também ficam fora da seleção automática: produtor rural pessoa física, associações e condomínios."),
  h("2. Dados tratados"),
  t(["Dado", "Origem", "Observação"], [30, 30, 40], [
    ["CNPJ, razão social, nome fantasia, natureza jurídica, porte, capital social, CNAE, data de abertura e endereço", "Receita Federal — dados abertos do CNPJ (publicação mensal)", "Dados da pessoa jurídica"],
    ["Telefone e e-mail cadastrais da empresa", "Receita Federal — dados abertos do CNPJ", "Podem pertencer a pessoa física (ex.: e-mail pessoal do sócio ou do contador): tratados como dado pessoal por cautela"],
    ["Telefone, WhatsApp, e-mail e nome da pessoa de contato confirmados", "Informados pela própria empresa ou obtidos pelo usuário em fonte pública (ex.: site da empresa)", "Dado pessoal do representante da empresa; registro da origem"],
    ["Histórico de contatos (data, canal, resultado, anotação) e pedido de não contato", "Próprio sistema", "Necessário para não repetir contato e respeitar o pedido de saída"],
  ]),
  p("Não são tratados: dados sensíveis, dados de crianças e adolescentes, CPF de pessoas físicas, perfis de redes sociais ou dados comprados de terceiros. Não há uso de inteligência artificial nem decisão automatizada sobre pessoas."),
  h("3. Teste de legítimo interesse"),
  t(["Etapa", "Avaliação"], [24, 76], [
    ["3.1 Finalidade legítima", "Oferecer serviços de Segurança do Trabalho e Meio Ambiente a empresas cujo ramo tem obrigações nessa área (ex.: NRs). Interesse comercial lícito do controlador e de utilidade para a empresa contatada, que tem obrigações legais de SST."],
    ["3.2 Necessidade", "Usa-se o mínimo para identificar a empresa e fazer um contato: dados cadastrais públicos da pessoa jurídica e um canal de contato. Não se coletam dados além disso. Empresas sem relação com os serviços não são selecionadas."],
    ["3.3 Balanceamento", "Expectativa razoável: os dados são publicados pela Receita Federal para dar transparência às empresas; o contato é profissional, dirigido à empresa, sobre o ramo dela. Impacto baixo: uma mensagem de apresentação, identificada, com saída fácil. Não há prejuízo financeiro, discriminação nem exposição de dados."],
    ["3.4 Salvaguardas", "Ver seção 4."],
  ]),
  h("4. Salvaguardas adotadas"),
  t(["Salvaguarda", "Como funciona no sistema"], [30, 70], [
    ["Identificação", "Toda mensagem identifica quem escreve, a AUDITA e a cidade (Sorocaba)."],
    ["Saída fácil", "WhatsApp: linha \"Se não fizer sentido agora, é só me avisar que não entro mais em contato.\" E-mail: link de descadastro em todas as mensagens."],
    ["Não contatar", "O pedido de saída vai para a lista \"não contatar\", que bloqueia qualquer novo contato pelo sistema, de forma permanente, com data e motivo."],
    ["WhatsApp sem disparo automático", "Cada mensagem é aberta pelo sistema e enviada manualmente pelo usuário (fila de envio assistida). Não há robô nem API de envio em massa."],
    ["E-mail com limite", "Envio pelo Brevo com remetente do domínio da AUDITA autenticado; limite diário (30 no início, até 100 por dia); pausa automática se as devoluções passarem de 3%; nunca reenvia a quem pediu para sair."],
    ["Contato da contabilidade", "Telefone ou e-mail repetido em 5 ou mais empresas é tratado como provável contato da contabilidade e não é usado para abordagem."],
    ["Guarda limitada", "Lead sem resposta: dados de contato e anotações anonimizados após 6 meses. A lista \"não contatar\" é mantida para garantir o pedido."],
    ["Acesso restrito", "Somente usuários autorizados (Diretor e mais um usuário), com senha e registro de atividades."],
    ["Origem registrada", "Cada lead guarda a origem do dado (publicação da Receita ou confirmação do usuário)."],
    ["Sem compartilhamento", "Os dados não são vendidos nem cedidos. Operadores: hospedagem própria (servidor da AUDITA) e Brevo (envio de e-mail)."],
    ["Direitos do titular", "Pedidos de acesso, correção, oposição ou eliminação pelo e-mail engenharia.audita@outlook.com, atendidos em até 15 dias."],
  ]),
  h("5. Riscos residuais e tratamento"),
  t(["Risco", "Tratamento"], [40, 60], [
    ["Dado cadastral desatualizado (telefone ou e-mail antigo)", "Exibição da data da publicação; correção pelo usuário; devoluções de e-mail retiram o endereço"],
    ["Telefone ou e-mail cadastral ser pessoal (sócio ou contador)", "Detecção de contato compartilhado; preferência por contato confirmado da empresa; saída fácil"],
    ["Reclamação de mensagem indesejada", "Saída imediata e permanente; limite diário; volume acompanhado no painel"],
  ]),
  h("6. Pontos para validação do advogado"),
  p("6.1. A hipótese do legítimo interesse (art. 7º, IX) é adequada para o primeiro contato comercial com empresas, por WhatsApp e por e-mail, nas condições acima?"),
  p("6.2. O texto de saída do WhatsApp e o link de descadastro do e-mail são suficientes?"),
  p("6.3. O prazo de 6 meses para anonimizar leads sem resposta é adequado?"),
  p("6.4. O aviso de privacidade da prospecção (Anexo) pode ser publicado na página de privacidade do site e referido no rodapé dos e-mails?"),
  p("6.5. Há algum ajuste recomendado antes de liberar o envio de e-mails em lote (até 100 por dia)?"),
  h("Anexo — Aviso de privacidade da prospecção (proposta)"),
  p("A AUDITA | SSMA & SGI pode entrar em contato com empresas para apresentar serviços de Segurança do Trabalho, Meio Ambiente e Sistemas de Gestão. Para isso, usamos dados públicos de empresas divulgados pela Receita Federal (CNPJ, razão social, atividade, endereço e contatos cadastrados) e, quando houver, o contato informado pela própria empresa. A base legal é o legítimo interesse (LGPD, art. 7º, IX). Não usamos dados sensíveis, não vendemos nem compartilhamos dados, e não fazemos envio automático de mensagens de WhatsApp. Se não quiser mais receber contatos, responda à mensagem ou use o link de descadastro do e-mail: sua empresa entra na nossa lista de não contato. Dados de empresas que não responderem são anonimizados após 6 meses. Para pedidos sobre seus dados, escreva para engenharia.audita@outlook.com."),
  h("Registro da validação"),
  t(["Campo", "Preenchimento"], [30, 70], [
    ["Resultado", "( ) Validado   ( ) Validado com ajustes   ( ) Não validado"],
    ["Ajustes recomendados", ""],
    ["Data da validação", "____/____/________"],
    ["Validação", "Advogado(a) da AUDITA (identificação mantida pelo Diretor)"],
  ]),
];

const buf = await renderDocx({
  templateCode: "LGPD-LIA",
  modelCode: "ESPEC",
  title: TITLE,
  reference: VERSAO,
  headerRight: `AUDITA · ${TITLE}`,
  footer: "AUDITA · Avaliação de Legítimo Interesse · Documento para validação jurídica",
  watermark: null,
  fileBase: "AUDITA_Avaliacao_Legitimo_Interesse_Prospeccao",
  blocks,
});
const out = path.join(process.argv[2], "AUDITA_Avaliacao_Legitimo_Interesse_Prospeccao.docx");
fs.writeFileSync(out, buf);
console.log(out, buf.length);
