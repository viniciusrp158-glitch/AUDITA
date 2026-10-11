/**
 * V1.1 — Documentos de formalização a partir do serviço contratado (AUDDOC017 RF-23; AUDDOC010-ANX03 a ANX06):
 *  - M03 Termo de aceite / confirmação de contratação
 *  - M04 Contrato de prestação de serviços técnicos (minuta jurídica — texto-base do ANX04)
 *  - M05 Ordem de serviço comercial (OS-COM)
 *  - M06 Registro de alteração de escopo (ALT)
 * Regras: dados vêm dos cadastros (cliente, proposta aceita, serviço contratado, dados institucionais vigentes);
 * o que faltar sai como "[PENDENTE: …]" e é listado ANTES da geração (RF-23). Todos saem como MINUTA pendente de revisão
 * jurídica (AUDDOC010 §7; caderno item 8) e, fora da produção, com a marca de teste. Nada é inventado.
 */
import Decimal from "decimal.js";
import { formatCnpj, formatCpf } from "@/lib/br";
import { brandName, proponentAddress, type ProponentSnapshot } from "@/lib/institutional";
import { formatBRL } from "@/lib/pricing/engine";
import { TEST_WATERMARK, type Block, type DocModel } from "./proposal";

export const LEGAL_WATERMARK = "MINUTA — PENDENTE DE REVISÃO JURÍDICA";
export const CONTROLLED_NOTICE =
  "MODELO CONTROLADO — USO EXTERNO CONDICIONADO À LIBERAÇÃO DO SERVIÇO E À REVISÃO JURÍDICA. Preencher todos os campos relevantes, verificar a situação do serviço na AUDDOC004 e obter revisão jurídica/contábil antes do uso externo.";

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

function contratada(i: ContractDocInput, f: Fill): string {
  const p = i.proponent;
  return [
    `${brandName(p)} — ${f.v("Razão social da AUDITA", p?.legal_name)}`,
    `CNPJ ${p?.cnpj ? formatCnpj(p.cnpj) : f.v("CNPJ da AUDITA", null)}`,
    f.v("Endereço da AUDITA", p ? proponentAddress(p) : null),
    `Representante: ${f.v("Representante da AUDITA", p?.signatory_name ? `${p.signatory_name}${p.signatory_role ? `, ${p.signatory_role}` : ""}` : null)}`,
  ].join(" — ");
}

function base(i: ContractDocInput, model: ContractModel, title: string, reference: string, blocks: Block[]): DocModel {
  const n = Number(model.slice(2));
  return {
    templateCode: `AUDDOC010-ANX0${n}` as DocModel["templateCode"],
    modelCode: model,
    title,
    reference,
    headerRight: `${title} · ${reference}`,
    footer: `${brandName(i.proponent)} · Gerado pelo sistema AUDITA a partir do modelo AUDDOC010-ANX0${n} Rev.00 · Emissão ${day(i.issuedOn)} · ${LEGAL_WATERMARK}`,
    watermark: i.test ? TEST_WATERMARK : LEGAL_WATERMARK,
    fileBase: `${i.test ? "TESTE_" : ""}${reference.replace(/[^\w-]+/g, "_")}_${model}`,
    blocks: [{ kind: "notice", label: "MINUTA", text: CONTROLLED_NOTICE }, ...blocks],
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

const CLAUSES: [string, string][] = [
  [
    "Cláusula 2 — Condições de execução",
    "A execução será agendada conforme disponibilidade e informações fornecidas pela CONTRATANTE. Atividades sujeitas a requisitos de habilitação, autorizações, equipamentos ou acesso somente serão iniciadas após comprovação dessas condições. Situações de risco grave poderão ensejar interrupção justificada, com comunicação e encaminhamento adequado.",
  ],
  [
    "Cláusula 3 — Deveres da CONTRATADA",
    "Atuar com diligência e dentro das atribuições profissionais e condições contratadas; manter sigilo; registrar a execução e entregar os produtos previstos; informar não conformidades relevantes observadas, limitações técnicas e pendências que dependam da CONTRATANTE.",
  ],
  [
    "Cláusula 4 — Deveres da CONTRATANTE",
    "Fornecer dados e documentos corretos, indicar interlocutor, viabilizar acessos e condições seguras, disponibilizar trabalhadores quando previsto, adotar medidas de sua responsabilidade e comunicar alterações de processos, riscos, instalações ou requisitos que impactem os serviços.",
  ],
  [
    "Cláusula 5 — Responsabilidades e limites",
    "A contratação de consultoria ou apoio técnico não transfere automaticamente à CONTRATADA obrigações legais do empregador, não substitui SESMT obrigatório quando exigível, não corresponde a certificação acreditada e não constitui garantia de inexistência de acidentes, multas, fiscalizações ou litígios. Obrigações técnicas privativas de profissionais não integrantes do escopo permanecem excluídas.",
  ],
  [
    "Cláusula 7 — Prazo, aceite e entregas",
    "Os prazos iniciam após a satisfação das condições documentais, de acesso e de contratação previstas. A entrega será realizada pelo canal acordado e considerada disponibilizada mediante comprovante rastreável; procedimentos de ajuste e revisão técnica serão pactuados conforme natureza do serviço.",
  ],
  [
    "Cláusula 8 — Confidencialidade e proteção de dados",
    "As partes restringirão o acesso às informações ao necessário para a execução contratada e adotarão medidas proporcionais de proteção. Finalidades, bases legais, papéis de controlador/operador e eventuais operadores terceiros deverão ser detalhados no instrumento ou anexo específico quando o serviço envolver tratamento relevante de dados pessoais, especialmente ocupacionais ou sensíveis.",
  ],
  [
    "Cláusula 9 — Uso de documentos e propriedade intelectual",
    "Os entregáveis contratados poderão ser utilizados pela CONTRATANTE para as finalidades acordadas, respeitados direitos sobre modelos, métodos, softwares, materiais didáticos e conteúdos preexistentes da AUDITA ou de terceiros. É vedada divulgação de dados ou imagens para publicidade sem fundamento apropriado e autorização exigível.",
  ],
  [
    "Cláusula 10 — Independência e organização da prestação",
    "As partes pretendem uma prestação de serviços independente, com organização e limites definidos pelo objeto contratado. A redação não afasta a avaliação da realidade da relação de trabalho e não poderá ser usada para dissimular vínculo de emprego quando caracterizados seus requisitos.",
  ],
];

export function buildM04(i: ContractDocInput): { model: DocModel; missing: string[] } {
  const f = new Fill();
  const ref = `${i.quote.code} Rev.${String(i.quote.revision).padStart(2, "0")}`;
  const vig = `${f.v("Data de início", day(i.contract.starts_on))} até ${i.contract.ends_on ? day(i.contract.ends_on) : f.v("Data de término ou prazo", null)}`;
  const blocks: Block[] = [
    { kind: "paragraph", text: "Base adaptável a serviços pontuais ou consultoria recorrente de SST. Não se aplica automaticamente à assinatura do Audita HUB, que terá termos próprios." },
    {
      kind: "fields",
      rows: [
        ["CONTRATANTE", `${i.client.legal_name}${taxId(i.client.tax_id) ? `, ${taxId(i.client.tax_id)}` : `, ${f.v("CNPJ/CPF do contratante", null)}`}, ${f.v("Endereço do contratante", i.client.address)} — representante legal: ${f.v("Representante legal do contratante", i.contract.client_representative)}`],
        ["CONTRATADA", contratada(i, f)],
        ["Referência comercial", `Proposta ${ref} · Serviço AUDDOC005 ${i.quote.service_codes || "—"} · Serviço contratado ${i.contract.code}`],
        ["Modalidade contratual", i.contract.modality === "recorrente" ? "Recorrente" : "Pontual"],
        ["Vigência", vig],
      ],
    },
    { kind: "heading", text: "Cláusula 1 — Objeto e anexos" },
    {
      kind: "paragraph",
      text: `A CONTRATADA prestará exclusivamente os serviços descritos no Anexo I / Proposta ${ref}, que integra este contrato para fins de delimitação de escopo, quantidade, unidades, cronograma, entregáveis e exclusões. Alterações relevantes dependerão de ajuste escrito ou registro equivalente aceito pelas partes.`,
    },
    ...CLAUSES.slice(0, 4).flatMap(([h, t]): Block[] => [{ kind: "heading", text: h }, { kind: "paragraph", text: t }]),
    { kind: "heading", text: "Cláusula 6 — Preço, faturamento e despesas" },
    {
      kind: "paragraph",
      text: `A remuneração, vencimentos, condições de faturamento e despesas aprovadas constam da Proposta ${ref}/Anexo II (${f.v("Valor contratado", totalText(i))}). Serviços extras serão submetidos à autorização prévia. Impostos e retenções serão tratados segundo o enquadramento fiscal efetivamente aplicável e confirmados antes da contratação.`,
    },
    ...CLAUSES.slice(4).flatMap(([h, t]): Block[] => [{ kind: "heading", text: h }, { kind: "paragraph", text: t }]),
    { kind: "heading", text: "Cláusula 11 — Alteração, suspensão e encerramento" },
    {
      kind: "paragraph",
      text: `Mudanças de escopo, cancelamento, reagendamento, aviso prévio, pagamento por serviços já prestados, restituições e eventuais multas deverão ser definidos especificamente conforme modalidade contratual e submetidos à revisão jurídica antes da assinatura. ${f.v("Condições negociadas de alteração, suspensão e encerramento (revisão jurídica)", null)}.`,
    },
    { kind: "heading", text: "Cláusula 12 — Responsabilidade civil e solução de conflitos" },
    {
      kind: "paragraph",
      text: `Critérios proporcionais de responsabilidade por falhas, danos, omissões, limitações, mediação e foro deverão ser pactuados sem excluir responsabilidades legalmente indisponíveis. ${f.v("Cláusula de responsabilidade e foro validada pela assessoria jurídica", null)}.`,
    },
    { kind: "heading", text: "Anexo I — Especificação do serviço" },
    {
      kind: "fields",
      rows: [
        ["Código do serviço / proposta", `${i.quote.service_codes || "—"} · ${ref}`],
        ["Escopo e exclusões", `${f.v("Escopo", i.quote.scope_included ?? i.contract.scope_summary)}${i.quote.scope_excluded ? `\nExclusões: ${i.quote.scope_excluded}` : ""}`],
        ["Visitas e rotina recorrente", i.contract.modality === "recorrente" ? f.v("Frequência e limites das visitas", i.quote.schedule) : "Não aplicável (serviço pontual)."],
        ["Entregáveis / periodicidade", f.v("Entregáveis", i.contract.deliverables)],
      ],
    },
    { kind: "heading", text: "Assinaturas e evidências de aceite" },
    {
      kind: "fields",
      rows: [
        ["CONTRATANTE", `${i.contract.client_representative ?? "________________________"} — ____/____/________ — Assinatura/evidência: ________________`],
        ["CONTRATADA", `${i.proponent?.signatory_name ?? "________________________"} — ____/____/________ — Assinatura/evidência: ________________`],
        ["Testemunhas (se aplicável)", "Nome/documentação mínima necessária conforme orientação jurídica."],
      ],
    },
    {
      kind: "notice",
      label: "REVISÃO OBRIGATÓRIA",
      text: "Este é um texto-base, não uma assessoria jurídica nem contrato pronto para assinatura. Validar cláusulas de rescisão, penalidades, foro, proteção de dados, regime tributário e riscos de vínculo antes da contratação.",
    },
  ];
  return { model: base(i, "M04", "Contrato de prestação de serviços técnicos (minuta jurídica)", i.contract.code, blocks), missing: f.missing };
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
