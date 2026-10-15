/**
 * Textos padrão aprovados no Caderno de Pendências (respondido em 14/10/2026) — AUDDOC010 M01 §3–§4; AUDDOC011 §8.
 *  - D5: condições comerciais padrão (pré-preenchidas em cada nova cotação, editáveis por proposta);
 *  - J1.04 a J1.09 e J6.03: cláusulas e alcance/limitações (fixos nos documentos, versão técnica v2 do M01/M02).
 * Mudança de texto = nova versão técnica do modelo (RF-21); propostas já emitidas não mudam (snapshot).
 */

/** D5.01 — validade padrão das propostas. */
export const DEFAULT_VALIDITY_DAYS = 15;
/** D5.05 — tempo de contrato padrão dos serviços mensais. */
export const DEFAULT_CONTRACT_MONTHS = 12;

/** D5.02, D5.03, C5 e decisão do Diretor (taxa 0% no cálculo; acréscimo de 5% informado para cartão). */
export function defaultPaymentTerms(recurring: boolean): string {
  return [
    "À vista.",
    recurring ? "Serviços mensais: vencimento em dia fixo a combinar com o cliente." : null,
    "Pix, boleto, transferência ou depósito bancário (Banco C6 S.A.), sem acréscimo.",
    "Pagamento com cartão de débito ou crédito: acréscimo de 5% sobre o valor.",
    "A nota fiscal é emitida após o aceite e a validação dos serviços pelo cliente" + (recurring ? "; nos contratos, mensalmente." : "."),
  ]
    .filter(Boolean)
    .join(" ");
}

/** D5.04 e D5.08. */
export const DEFAULT_ADDITIONAL_EXPENSES =
  "Sem cobrança de deslocamento em Sorocaba/SP. Fora de Sorocaba, despesas de deslocamento, pedágio, hospedagem e aluguel de equipamentos, quando houver, " +
  "constam deste orçamento. Nenhuma outra despesa é cobrada sem aprovação prévia do cliente.";

/** J1.04 — reagendamento e cancelamento. */
export const DEFAULT_CANCELLATION_TERMS =
  "Reagendamento sem custo com 2 dias úteis ou mais de antecedência (1 vez por atividade). Com menos de 2 dias úteis: taxa de 20% do valor da atividade. " +
  "Cancelamento: sem multa com 5 dias úteis ou mais; 30% entre 5 e 2 dias úteis; 50% com menos de 2 dias úteis ou impedimento de execução no local. " +
  "Em todos os casos são devidas as despesas já realizadas e comprovadas e as etapas já executadas. Serviços mensais: aviso prévio de 30 dias. " +
  "Cancelamento pela AUDITA: devolução integral dos valores de atividades não executadas.";

/** D5.07. */
export const DEFAULT_NEXT_STEP = "Combinar detalhes para execução.";

/** J1.05 — mora. */
export const LATE_PAYMENT_TEXT =
  "Em caso de atraso: multa de 2%, juros de 1% ao mês proporcionais aos dias de atraso e correção pelo IPCA. " +
  "Atraso superior a 15 dias permite suspender os serviços pendentes, com aviso prévio de 5 dias úteis.";

/** J1.06 — reajuste dos serviços mensais. */
export const ADJUSTMENT_TEXT =
  "Valor mensal reajustado a cada 12 meses a partir do início do contrato, pela variação acumulada do IPCA/IBGE (sem redução em caso de variação negativa), com aviso de 30 dias.";

/** J1.07 — rescisão antecipada dos serviços mensais (período mínimo de 1 mês). */
export const EARLY_TERMINATION_TEXT =
  "Rescisão por qualquer das partes com aviso prévio de 30 dias, com mensalidades devidas durante o aviso. Há período mínimo de 1 mês: a rescisão antecipada " +
  "pelo contratante dentro desse período gera multa de 20% sobre as mensalidades restantes do período. São sempre devidos os serviços prestados, as despesas " +
  "comprovadas e os valores em atraso.";

/** J1.08 — limite de responsabilidade. */
export const LIABILITY_TEXT =
  "Os serviços são de meio: não garantem conformidade total, certificação, ausência de acidentes, multas ou fiscalizações, nem resultado em processos. " +
  "Relatórios e auditorias da AUDITA não são certificação acreditada. As obrigações legais do empregador permanecem com o contratante. A responsabilidade da " +
  "AUDITA limita-se ao valor pago pelo serviço (ou aos últimos 12 meses, nos mensais), exceto em caso de dolo, culpa grave, danos pessoais e violação de dados.";

/** J1.09 — solução de conflitos e foro. */
export const FORUM_TEXT =
  "Divergências serão tratadas primeiro por negociação direta (15 dias úteis) e, se as partes quiserem, por mediação. Não havendo acordo, fica eleito o foro " +
  "da Comarca de Sorocaba/SP, ressalvado o foro do domicílio do consumidor quando aplicável.";

/** J6.03 — texto médio (propostas e relatórios). */
export const SCOPE_LIMITS_TEXT =
  "Este serviço é executado com diligência técnica, conforme o escopo descrito. Ele não assegura conformidade legal total, não constitui certificação ou " +
  "auditoria de certificação e não garante a eliminação de multas, autuações, acidentes ou litígios. O certificado de treinamento registra a participação e o " +
  "aproveitamento; ele não substitui a autorização do trabalhador pelo empregador nem transfere ao contratado as obrigações legais do empregador.";

/** J6.03 — texto curto (rodapés, orçamento simplificado e comunicação). */
export const SCOPE_LIMITS_SHORT =
  "A AUDITA presta serviços de treinamento e capacitação. Os serviços não constituem certificação nem garantia de conformidade legal ou de ausência de multas e autuações.";
