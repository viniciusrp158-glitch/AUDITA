/**
 * V1.1 — Documentos de formalização a partir do serviço contratado (AUDDOC017 RF-23; AUDDOC010-ANX03 a ANX06):
 *  - M03 Termo de aceite / confirmação de contratação
 *  - M04 Contrato de prestação de serviços técnicos (minuta jurídica — texto-base do ANX04)
 *  - M05 Ordem de serviço comercial (OS-COM)
 *  - M06 Registro de alteração de escopo (ALT)
 * Regras: dados vêm dos cadastros (cliente, proposta aceita, serviço contratado, dados institucionais vigentes);
 * o que faltar sai como "[PENDENTE: …]" e é listado ANTES da geração (RF-23). Textos aprovados no Caderno de Pendências
 * (14/10/2026): M04 "com ajustes" (J2.02 — contrato de treinamento), qualificação do emitente (J1.10), cláusulas J1.04–J1.09
 * e J6.03; M03, M05 e M06 com a identificação do emitente. Fora da produção, sai com a marca de teste. Nada é inventado.
 */
import Decimal from "decimal.js";
import { formatCnpj, formatCpf } from "@/lib/br";
import {
  ADJUSTMENT_TEXT,
  DEFAULT_CANCELLATION_TERMS,
  EARLY_TERMINATION_TEXT,
  FORUM_TEXT,
  LATE_PAYMENT_TEXT,
  LIABILITY_TEXT,
} from "@/lib/commercial-standards";
import { contractorQualification, issuedByLine, issuerLine, type ProponentSnapshot } from "@/lib/institutional";
import { formatBRL } from "@/lib/pricing/engine";
import { TEST_WATERMARK, type Block, type DocModel } from "./proposal";

/** Versão técnica dos modelos M03–M06 gerados pelo sistema (v2 = textos do caderno de 14/10/2026). */
export const CONTRACT_TECH_VERSION = "v2";

export type ContractDocInput = {
  issuedOn: string; // AAAA-MM-DD (São Paulo)
  test: boolean;
  contract: {
    code: string;
    modality: "pontual" | "recorrente";
    starts_on: string | null;
    ends_on: string | null;
    executor_name: string | null;
    executor_role: string | null;
    client_representative: string | null;
    scope_summary: string | null;
    deliverables: string | null;
    additional_conditions: string | null;
  };
  client: {
    code: string;
    legal_name: string;
    tax_id: string | null;
    address: string | null;
    city_uf: string | null;
  };
  quote: {
    code: string;
    revision: number;
    accepted_on: string | null;
    accepted_by_name: string | null;
    decision_reference: string | null;
    total_once: string | null;
    total_monthly: string | null;
    schedule: string | null;
    location_modality: string | null;
    scope_included: string | null;
    scope_excluded: string | null;
    service_codes: string;
  };
  proponent: ProponentSnapshot | null;
  order?: {
    code: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    time_window: string | null;
    location: string | null;
    executor_name: string | null;
    executor_role: string | null;
    client_contact: string | null;
    activities: { atividade: string; entrega?: string; condicao?: string }[];
    access_conditions: string | null;
    pending_conditions: string | null;
    released_by_name: string | null;
    released_on: string | null;
    status: string;
  };
  change?: {
    code: string;
    reason: string;
    activities_before: string | null;
    activities_after: string | null;
    deadline_before: string | null;
    deadline_after: string | null;
    value_before: string | null;
    value_after: string | null;
    deliverables_before: string | null;
    deliverables_after: string | null;
    client_approval: string | null;
    validated_by_name: string | null;
    validated_on: string | null;
    documents_update: string | null;
  };
};

export type ContractModel = "M03" | "M04" | "M05" | "M06";

const day = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** Coletor de campos ausentes: devolve o valor ou "[PENDENTE: rótulo]" e anota o rótulo. */
class Fill {
  missing: string[] = [];
  v(label: string, value: string | null | undefined): string {
    const t = (value ?? "").trim();
    if (t) return t;
    if (!this.missing.includes(label)) this.missing.push(label);
    return `[PENDENTE: ${label}]`;
  }
}

function taxId(t: string | null): string | null {
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  return d.length === 14 ? `CNPJ ${formatCnpj(d)}` : d.length === 11 ? `CPF ${formatCpf(d)}` : t;
}

function totalText(i: ContractDocInput): string | null {
  const parts = [
    i.quote.total_once ? `${formatBRL(new Decimal(i.quote.total_once))} (parcela única)` : null,
    i.quote.total_monthly ? `${formatBRL(new Decimal(i.quote.total_monthly))}/mês (recorrente)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : null;
}

function base(i: ContractDocInput, model: ContractModel, title: string, reference: string, blocks: Block[]): DocModel {
  const n = Number(model.slice(2));
  return {
    templateCode: `AUDDOC010-ANX0${n}` as DocModel["templateCode"],
    modelCode: model,
    title,
    reference,
    headerRight: `${title} · ${reference}`,
    footer: `${issuerLine(i.proponent)} · Gerado pelo sistema AUDITA a partir do modelo AUDDOC010-ANX0${n} Rev.00 (versão técnica ${CONTRACT_TECH_VERSION}) · Emissão ${day(i.issuedOn)}`,
    watermark: i.test ? TEST_WATERMARK : null,
    fileBase: `${i.test ? "TESTE_" : ""}${reference.replace(/[^\w-]+/g, "_")}_${model}`,
    blocks: [{ kind: "paragraph", text: issuedByLine(i.proponent) }, ...blocks],
  };
}

export function buildM03(i: ContractDocInput): { model: DocModel; missing: string[] } {
  const f = new Fill();
  const blocks: Block[] = [
    { kind: "paragraph", text: "Opcional quando a proposta M01 já tiver aceite inequívoco. Útil se a aprovação ocorrer em documento ou canal separado." },
    {
      kind: "fields",
      rows: [
        ["Cliente / representante", `${i.client.legal_name}${taxId(i.client.tax_id) ? ` (${taxId(i.client.tax_id)})` : ""} — ${f.v("Representante do cliente", i.contract.client_representative)}`],
        ["Proposta aceita", `${i.quote.code} Rev.${String(i.quote.revision).padStart(2, "0")} — aceite em ${f.v("Data do aceite", day(i.quote.accepted_on))}`],
        ["Objeto e valor total", `${f.v("Objeto", i.contract.scope_summary)} — ${f.v("Valor total", totalText(i))}`],
        ["Prazo / modalidade", `${f.v("Prazo", i.quote.schedule)} — ${i.contract.modality === "recorrente" ? "recorrente" : "pontual"}`],
        ["Condições adicionais aceitas", i.contract.additional_conditions?.trim() || "Nenhuma além da proposta referenciada."],
      ],
    },
    {
      kind: "notice",
      label: "DECLARAÇÃO DE ACEITE",
      text: "Confirmo que tive acesso à proposta identificada acima e concordo com seu escopo, exclusões, prazos, responsabilidades, valores e condições comerciais nela previstas, ressalvadas as condições suspensivas expressamente informadas.",
    },
    {
      kind: "fields",
      rows: [
        ["Nome do representante", `${f.v("Nome e cargo do representante", i.quote.accepted_by_name ?? i.contract.client_representative)}`],
        ["Data e local", `____/____/________ — ${i.client.city_uf ?? "________________"}`],
        ["Evidência da manifestação", i.quote.decision_reference?.trim() || "Assinatura / e-mail confirmado / registro eletrônico com autoria e data: ______________________"],
      ],
    },
    { kind: "notice", label: "DISPENSÁVEL", text: "Evitar produzir novo termo de aceite quando já existe prova equivalente e inequívoca junto à proposta." },
  ];
  return { model: base(i, "M03", "Termo de aceite / confirmação de contratação", i.contract.code, blocks), missing: f.missing };
}

const P = (text: string): Block => ({ kind: "paragraph", text });
const H = (text: string): Block => ({ kind: "heading", text });

/** Cláusulas do M04 sem alteração no caderno (2, 3, 4, 7 e 9 do texto-base do AUDDOC010-ANX04). */
const KEPT: Record<"c2" | "c3" | "c4" | "c7" | "c9", [string, string]> = {
  c2: [
    "Cláusula 2 — Condições de execução",
    "A execução será agendada conforme disponibilidade e informações fornecidas pelo CONTRATANTE. Atividades sujeitas a requisitos de habilitação, autorizações, equipamentos ou acesso somente serão iniciadas após comprovação dessas condições. Situações de risco grave poderão ensejar interrupção justificada, com comunicação e encaminhamento adequado.",
  ],
  c3: [
    "Cláusula 3 — Deveres da CONTRATADA",
    "Atuar com diligência e dentro das atribuições profissionais e condições contratadas; manter sigilo; registrar a execução e entregar os produtos previstos; informar não conformidades relevantes observadas, limitações técnicas e pendências que dependam do CONTRATANTE.",
  ],
  c4: [
    "Cláusula 4 — Deveres do CONTRATANTE",
    "Fornecer dados e documentos corretos, indicar interlocutor, viabilizar acessos e condições seguras, disponibilizar trabalhadores quando previsto, adotar medidas de sua responsabilidade e comunicar alterações de processos, riscos, instalações ou requisitos que impactem os serviços.",
  ],
  c7: [
    "Cláusula 7 — Prazo, aceite e entregas",
    "Os prazos iniciam após a satisfação das condições documentais, de acesso e de contratação previstas. A entrega será realizada pelo canal acordado e considerada disponibilizada mediante comprovante rastreável; procedimentos de ajuste e revisão técnica serão pactuados conforme a natureza do serviço.",
  ],
  c9: [
    "Cláusula 9 — Uso de documentos e propriedade intelectual",
    "Os entregáveis contratados poderão ser utilizados pelo CONTRATANTE para as finalidades acordadas, respeitados direitos sobre modelos, métodos, softwares, materiais didáticos e conteúdos preexistentes da AUDITA ou de terceiros. É vedada divulgação de dados ou imagens para publicidade sem fundamento apropriado e autorização exigível.",
  ],
};
const kept = (k: keyof typeof KEPT): Block[] => [H(KEPT[k][0]), P(KEPT[k][1])];

/** Tabela de penalidades (Cláusula 11.4 — caderno J2.02, valores confirmados como definitivos em 14/10/2026). */
const PENALTIES: string[][] = [
  ["Reagendamento ≥ 2 dias úteis (1ª vez)", "Sem custo"],
  ["Reagendamento < 2 dias úteis ou a partir da 2ª vez", "20% do valor da atividade + despesas comprovadas"],
  ["Cancelamento ≥ 5 dias úteis", "Só despesas comprovadas"],
  ["Cancelamento entre 5 e 2 dias úteis", "30% da atividade + despesas comprovadas"],
  ["Cancelamento < 2 dias úteis, ausência ou impedimento no local", "50% da atividade + despesas comprovadas"],
  ["Atraso de pagamento", "Multa de 2% + juros de 1% ao mês proporcionais + IPCA"],
  ["Atraso > 15 dias", "Suspensão com aviso de 5 dias úteis"],
  ["Atraso > 60 dias", "Rescisão por motivo justo"],
  ["Rescisão de serviço mensal sem motivo", "Aviso prévio de 30 dias (+ 20% das parcelas restantes do período mínimo de 1 mês)"],
  ["Cancelamento ou falha da AUDITA", "Devolução integral do não executado; correção sem custo"],
];

export function buildM04(i: ContractDocInput): { model: DocModel; missing: string[] } {
  const f = new Fill();
  const ref = `${i.quote.code} Rev.${String(i.quote.revision).padStart(2, "0")}`;
  const vig = `${f.v("Data de início", day(i.contract.starts_on))} até ${i.contract.ends_on ? day(i.contract.ends_on) : f.v("Data de término ou prazo", null)}`;
  const q = contractorQualification(i.proponent);
  for (const m of q.missing) f.v(m, null);
  const blocks: Block[] = [
    {
      kind: "fields",
      rows: [
        ["CONTRATANTE", `${i.client.legal_name}${taxId(i.client.tax_id) ? `, ${taxId(i.client.tax_id)}` : `, ${f.v("CNPJ/CPF do contratante", null)}`}, ${f.v("Endereço do contratante", i.client.address)} — representante legal: ${f.v("Representante legal do contratante", i.contract.client_representative)}`],
        ["CONTRATADA", q.text],
        ["Referência comercial", `Proposta ${ref} · Serviço AUDDOC005 ${i.quote.service_codes || "—"} · Serviço contratado ${i.contract.code}`],
        ["Modalidade contratual", i.contract.modality === "recorrente" ? "Recorrente" : "Pontual"],
        ["Vigência", vig],
      ],
    },
    H("Cláusula 1 — Objeto"),
    P(`1.1. A CONTRATADA prestará ao CONTRATANTE serviços de treinamento em desenvolvimento profissional e gerencial, compatíveis com a atividade registrada (CNAE 8599-6/04), conforme descritos na Proposta ${ref}, que integra este contrato (Anexo I). A proposta delimita temas, carga horária, modalidade (presencial ou remota), turmas, número de participantes, local, cronograma, materiais, avaliação, certificados e exclusões.`),
    P("1.2. Não fazem parte deste contrato consultoria, auditoria, elaboração de programas ou documentos legais (como PGR, PCMSO e laudos), responsabilidade técnica por instalações nem qualquer atividade fora do CNAE registrado."),
    P("1.3. Mudanças relevantes de objeto, quantidade, prazo ou preço dependem de registro de alteração de escopo (M06) aceito pelas partes."),
    ...kept("c2"),
    ...kept("c3"),
    ...kept("c4"),
    H("Cláusula 5 — Responsabilidades e limites"),
    P("5.1. O que a CONTRATADA garante: executar o escopo contratado com diligência técnica e no prazo combinado; ministrar conteúdo compatível com as normas regulamentadoras vigentes na data do treinamento; entregar os documentos previstos (lista de presença, avaliações, certificados e relatório); corrigir, sem custo, erros materiais nos documentos que emitir."),
    P("5.2. O que a CONTRATADA não garante: os serviços de treinamento não asseguram conformidade legal total do CONTRATANTE; não constituem certificação, auditoria de certificação ou acreditação, nem garantem aprovação em auditorias de clientes, certificadoras ou órgãos públicos; não garantem a inexistência ou a eliminação de autuações, multas, interdições, acidentes, doenças ocupacionais, ações judiciais ou fiscalizações; não equivalem à autorização do trabalhador para atividades de risco, que é ato exclusivo do empregador quando a norma exigir (como na NR-10 e na NR-35); e não garantem a aprovação de todos os participantes nem a mudança de comportamento no trabalho."),
    P("5.3. O contrato não transfere à CONTRATADA as obrigações legais do empregador, entre elas elaborar e implementar o PGR e o PCMSO, avaliar a aptidão de saúde, fornecer EPI, emitir as ordens de serviço de SST, autorizar trabalhadores e manter o SESMT quando exigível."),
    P("5.4. O treinamento capacita os participantes nos conteúdos programados e tem natureza de obrigação de meio. Não comprova, sozinho, a aptidão ou a autorização do trabalhador para atividades de risco. Continuam com o CONTRATANTE, como empregador: a avaliação de aptidão (inclusive médica, quando exigida); a autorização formal; a supervisão; a reciclagem nos prazos das Normas Regulamentadoras; e a guarda dos registros de capacitação."),
    P("5.5. O certificado é emitido aos participantes que cumprirem a frequência e os critérios de avaliação da proposta. Ele não é certificação acreditada."),
    P("5.6. Para treinamentos de Normas Regulamentadoras que exijam requisitos específicos do instrutor, de carga horária ou de prática, a CONTRATADA só executará o treinamento se esses requisitos estiverem atendidos e comprovados. Se não estiverem, o treinamento não será ofertado."),
    P("5.7. As limitações acima não afastam a responsabilidade da CONTRATADA por falhas na execução do que ela própria se comprometeu a fazer, nos limites da Cláusula 12."),
    H("Cláusula 6 — Preço, faturamento, mora e reajuste"),
    P(`6.1. A remuneração, os vencimentos, as condições de faturamento e as despesas aprovadas constam da Proposta ${ref} (${f.v("Valor contratado", totalText(i))}). Serviços extras dependem de autorização prévia.`),
    P(`6.2. ${LATE_PAYMENT_TEXT}`),
    ...(i.contract.modality === "recorrente" ? [P(`6.3. ${ADJUSTMENT_TEXT}`)] : []),
    ...kept("c7"),
    H("Cláusula 8 — Confidencialidade e proteção de dados (LGPD)"),
    P("8.1. Confidencialidade. As partes manterão sigilo sobre as informações técnicas, comerciais e operacionais recebidas da outra parte. Elas serão usadas só para executar este contrato, inclusive depois do seu término, pelo prazo de 5 anos. Não são confidenciais as informações já públicas ou cuja divulgação seja exigida por lei ou autoridade."),
    P("8.2. Dados dos participantes — papéis. Para inscrição, lista de presença, avaliação e emissão de certificados, o CONTRATANTE é o controlador dos dados pessoais dos seus trabalhadores e a CONTRATADA atua como operadora, tratando os dados conforme as instruções do CONTRATANTE e somente para essas finalidades. A CONTRATADA é controladora apenas dos dados necessários aos seus registros próprios: comprovação do serviço prestado, emissão e verificação da autenticidade de certificados, obrigações legais e fiscais, e defesa em processos."),
    P("8.3. Dados mínimos. Serão tratados apenas os dados necessários: nome, CPF ou documento de identificação, função e assinatura de presença. Não serão coletados dados de saúde nem dados sensíveis, salvo quando indispensáveis ao treinamento, com base legal informada por escrito pelo CONTRATANTE e cláusula específica."),
    P("8.4. Obrigações da CONTRATADA: adotar medidas de segurança proporcionais (acesso restrito, armazenamento em ambiente protegido); não compartilhar os dados com terceiros, salvo os fornecedores necessários à execução (por exemplo, hospedagem e e-mail), que ficam sujeitos às mesmas obrigações; comunicar ao CONTRATANTE, em até 2 dias úteis depois de tomar conhecimento, qualquer incidente de segurança que possa envolver esses dados; apoiar o CONTRATANTE no atendimento aos direitos dos titulares."),
    P("8.5. Obrigações do CONTRATANTE: fornecer os dados com base legal adequada e informar aos participantes o tratamento realizado (por exemplo, no aviso de privacidade aos empregados)."),
    P("8.6. Guarda e eliminação. Encerrado o contrato, a CONTRATADA guardará os registros de presença e de certificados por 10 anos, para comprovação e verificação de autenticidade. Depois disso, os dados serão anonimizados. Os demais dados do CONTRATANTE serão devolvidos ou anonimizados a pedido dele."),
    P("8.7. Imagens. Fotos e vídeos de participantes ou instalações só podem ser feitos e usados com autorização prévia e escrita do CONTRATANTE e, quando exigido, dos participantes. Nunca serão usados em divulgação sem essa autorização."),
    ...kept("c9"),
    H("Cláusula 10 — Independência e ausência de vínculo"),
    P("10.1. Este contrato é uma prestação de serviços entre o CONTRATANTE e a CONTRATADA, que atua como microempreendedor individual, com autonomia técnica e organização própria do seu trabalho, dentro do escopo, das datas e dos locais acordados. Não cria vínculo empregatício, societário ou de representação entre as partes."),
    P("10.2. Não há subordinação, controle de jornada nem exclusividade. A CONTRATADA pode atender outros clientes."),
    P("10.3. Instrutores ou auxiliares que a CONTRATADA vier a usar são de responsabilidade exclusiva dela, que responde pelas obrigações trabalhistas, previdenciárias e fiscais correspondentes, observados os limites legais do MEI. Eles não têm vínculo com o CONTRATANTE."),
    P("10.4. Os participantes do treinamento continuam sob responsabilidade e subordinação do CONTRATANTE durante as atividades, inclusive quanto à jornada, à segurança no local e ao uso de EPI nas atividades práticas."),
    P("10.5. Esta redação não afasta a análise da realidade da relação. As partes se comprometem a não usá-la para disfarçar relação de emprego."),
    H("Cláusula 11 — Alteração, suspensão e encerramento"),
    P(`11.1. Reagendamento e cancelamento de atividades: ${DEFAULT_CANCELLATION_TERMS}`),
    P(`11.2. Suspensão por atraso de pagamento: conforme a Cláusula 6.2.`),
    P(`11.3. Rescisão de serviços mensais ou de programas de treinamento recorrentes: ${EARLY_TERMINATION_TEXT}`),
    P("11.4. Tabela de penalidades (resumo; prevalece o texto das cláusulas):"),
    { kind: "table", headers: ["SITUAÇÃO", "CONSEQUÊNCIA"], widths: [50, 50], align: ["left", "left"], rows: PENALTIES, totals: [] },
    P("11.5. As penalidades não se somam pelo mesmo fato. Elas substituem perdas e danos, salvo nos casos de exclusão do limite de responsabilidade."),
    H("Cláusula 12 — Responsabilidade civil e foro"),
    P(`12.1. Limite de responsabilidade: ${LIABILITY_TEXT}`),
    P(`12.2. Solução de conflitos e foro: ${FORUM_TEXT}`),
    H("Anexo I — Especificação do serviço"),
    {
      kind: "fields",
      rows: [
        ["Código do serviço / proposta", `${i.quote.service_codes || "—"} · ${ref}`],
        ["Escopo e exclusões", `${f.v("Escopo", i.quote.scope_included ?? i.contract.scope_summary)}${i.quote.scope_excluded ? `\nExclusões: ${i.quote.scope_excluded}` : ""}`],
        ["Visitas e rotina recorrente", i.contract.modality === "recorrente" ? f.v("Frequência e limites das visitas", i.quote.schedule) : "Não aplicável (serviço pontual)."],
        ["Entregáveis / periodicidade", f.v("Entregáveis", i.contract.deliverables)],
      ],
    },
    H("Assinaturas"),
    {
      kind: "fields",
      rows: [
        ["CONTRATANTE", `${i.contract.client_representative ?? "________________________"} — ____/____/________ — Assinatura: ________________`],
        ["CONTRATADA", `${i.proponent?.signatory_name ?? "________________________"}, titular — ____/____/________ — Assinatura: ________________`],
      ],
    },
    P("Assinatura eletrônica, certificado digital ou assinatura física (caderno J5.02). Sem testemunhas (caderno J2.03)."),
  ];
  return { model: base(i, "M04", "Contrato de prestação de serviços de treinamento", i.contract.code, blocks), missing: f.missing };
}

export function buildM05(i: ContractDocInput): { model: DocModel; missing: string[] } {
  const f = new Fill();
  const o = i.order!;
  const acts = o.activities.length ? o.activities : [{ atividade: f.v("Atividades", null) }];
  const blocks: Block[] = [
    { kind: "paragraph", text: "Registro interno de programação e autorização operacional, emitido após o aceite. Não substitui a OS de Segurança e Saúde no Trabalho prevista em normas quando aplicável." },
    {
      kind: "fields",
      rows: [
        ["Identificação", `${o.code} | Data ${day(i.issuedOn)}`],
        ["Cliente", `${i.client.code} — ${i.client.legal_name}${i.client.city_uf ? ` — ${i.client.city_uf}` : ""}`],
        ["Serviço / contratação", `${i.quote.service_codes || "—"} · Proposta ${i.quote.code} Rev.${String(i.quote.revision).padStart(2, "0")} · ${i.contract.code}`],
        ["Responsável pela execução", f.v("Responsável pela execução", o.executor_name ? `${o.executor_name}${o.executor_role ? ` — ${o.executor_role}` : ""}` : null)],
        ["Contato operacional no cliente", f.v("Contato operacional no cliente", o.client_contact)],
        ["Data / horário", `${f.v("Data de início", day(o.scheduled_start))}${o.scheduled_end ? ` a ${day(o.scheduled_end)}` : ""}${o.time_window ? ` — ${o.time_window}` : ""}`],
        ["Local / modalidade", f.v("Local / modalidade", o.location)],
      ],
    },
    { kind: "heading", text: "Execução autorizada" },
    {
      kind: "table",
      headers: ["ATIVIDADE", "ENTREGA / REGISTRO", "CONDIÇÃO / OBSERVAÇÃO"],
      widths: [40, 30, 30],
      align: ["left", "left", "left"],
      rows: acts.map((a) => [a.atividade, a.entrega || "—", a.condicao || "—"]),
      totals: [],
    },
    {
      kind: "fields",
      rows: [
        ["Riscos e condições de acesso", f.v("Riscos e condições de acesso", o.access_conditions)],
        ["Referência ao aceite", `Proposta ${i.quote.code} — aceite em ${f.v("Data do aceite", day(i.quote.accepted_on))}${i.quote.decision_reference ? ` — ${i.quote.decision_reference}` : ""}`],
        ["Condicionantes pendentes", o.pending_conditions?.trim() || "Nenhuma"],
        [
          "Liberação interna para execução",
          o.status === "rascunho" ? "NÃO LIBERADA — aguardando requisitos" : `${o.released_by_name ?? "—"} — ${day(o.released_on) ?? "—"} — ${o.status === "cancelada" ? "cancelada" : "liberada"}`,
        ],
      ],
    },
    { kind: "notice", label: "NÃO CONFUNDIR INSTRUMENTOS", text: "A OS comercial organiza a execução contratual. Não substitui a Ordem de Serviço de SST a ser emitida pelo empregador quando exigida." },
  ];
  return { model: base(i, "M05", "Ordem de serviço comercial", o.code, blocks), missing: f.missing };
}

export function buildM06(i: ContractDocInput): { model: DocModel; missing: string[] } {
  const f = new Fill();
  const a = i.change!;
  const money = (v: string | null, label: string) => (v ? formatBRL(new Decimal(v)) : f.v(label, null));
  const blocks: Block[] = [
    { kind: "paragraph", text: "Usar somente quando houver mudança relevante de objeto, quantidade, preço, prazo ou entregáveis. Mudanças simples de agenda podem ser registradas no e-mail ou na ordem de serviço." },
    {
      kind: "fields",
      rows: [
        ["Referência original", `Proposta ${i.quote.code} Rev.${String(i.quote.revision).padStart(2, "0")} / ${i.contract.code}`],
        ["Cliente", `${i.client.legal_name} — ${f.v("Responsável pela autorização", i.contract.client_representative)}`],
        ["Motivo da mudança", a.reason],
      ],
    },
    {
      kind: "table",
      headers: ["ELEMENTO", "ANTES", "DEPOIS"],
      widths: [20, 40, 40],
      align: ["left", "left", "left"],
      rows: [
        ["Atividades", a.activities_before || "Sem alteração", a.activities_after || "Sem alteração"],
        ["Prazo", a.deadline_before || "Sem alteração", a.deadline_after || "Sem alteração"],
        [
          "Valor",
          a.value_before || a.value_after ? money(a.value_before, "Valor anterior") : "Sem alteração",
          a.value_before || a.value_after ? money(a.value_after, "Novo valor") : "Sem alteração",
        ],
        ["Entregáveis", a.deliverables_before || "Sem alteração", a.deliverables_after || "Sem alteração"],
      ],
      totals: [],
    },
    {
      kind: "paragraph",
      text: "As demais condições da contratação original permanecem inalteradas, salvo as expressamente modificadas aqui. A alteração passa a valer somente após aceite rastreável das partes e verificação da viabilidade técnica, profissional e fiscal.",
    },
    {
      kind: "fields",
      rows: [
        ["Aprovação do cliente", f.v("Aprovação do cliente (nome/função, data, meio e referência)", a.client_approval)],
        ["Validação AUDITA", f.v("Validação AUDITA (responsável e data)", a.validated_by_name ? `${a.validated_by_name} — ${day(a.validated_on) ?? "—"}` : null)],
        ["Atualização de documentos", a.documents_update?.trim() || "Não necessária"],
      ],
    },
  ];
  return { model: base(i, "M06", "Registro de alteração de escopo", a.code, blocks), missing: f.missing };
}

export function buildContractDocument(model: ContractModel, i: ContractDocInput) {
  return model === "M03" ? buildM03(i) : model === "M04" ? buildM04(i) : model === "M05" ? buildM05(i) : buildM06(i);
}
