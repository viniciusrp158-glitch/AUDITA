/**
 * Carga da configuração REAL a partir do Caderno de Pendências respondido (14/10/2026) — rodar só DEPOIS da limpeza
 * dos dados de teste (scripts/limpeza-dados-teste.sql), com autorização do Diretor:
 *  1) Dados institucionais (C1, D6, J1.10) → versão publicada;
 *  2) Parâmetros financeiros (C2–C5, D1; pró-labore-alvo do item 6) → versão publicada;
 *  3) Decisões do catálogo (D3/D4) com fundamento e comprovações.
 * Idempotente: não repete o que já está vigente/decidido. Nada é marcado como teste.
 * Credenciais: AUDITA_IMPORT_EMAIL/AUDITA_IMPORT_PASSWORD (administrador), AUDITA_TITULAR_CPF e as variáveis públicas do Supabase.
 * Uso: node scripts/carga-configuracao-real.mjs
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "audita" },
  auth: { persistSession: false },
});
const { error: authError } = await db.auth.signInWithPassword({
  email: process.env.AUDITA_IMPORT_EMAIL ?? process.env.TEST_ADMIN_EMAIL,
  password: process.env.AUDITA_IMPORT_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD,
});
if (authError) throw authError;
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

// 1) Dados institucionais ------------------------------------------------------------------------------------------
const INSTITUTIONAL = {
  legal_name: "69.563.249 VINICIUS ROCHA PEREIRA",
  trade_name: "AUDITA | SSMA & SGI",
  cnpj: "69563249000101",
  legal_nature: "Microempreendedor individual (MEI)",
  cnae_main: "8599-6/04 - Treinamento em desenvolvimento profissional e gerencial",
  cnae_secondary: null,
  municipal_registration: null,
  state_registration: null,
  tax_regime: "Simples Nacional — MEI (SIMEI)",
  address_street: "Rua Oswaldo de Barros",
  address_number: "219",
  address_complement: null,
  address_district: "Conjunto Habitacional Herbert de Souza",
  address_zip: "18079026",
  address_city: "Sorocaba",
  address_state: "SP",
  email: "engenharia.audita@outlook.com",
  phone: "15996891049",
  website: "audita.seg.br",
  technical_lead_name: "Vinicius Rocha Pereira",
  technical_lead_registration: "Técnico em Segurança do Trabalho, registro MTE nº 0120523",
  show_technical_lead: true,
  signatory_name: "Vinicius Rocha Pereira",
  signatory_role: "Diretor",
  // CPF do titular: informado por variável de ambiente (dado pessoal — não fica no Git)
  signatory_cpf: (process.env.AUDITA_TITULAR_CPF ?? "").replace(/\D/g, "") || null,
  full_address_on_proposal: false,
  notes:
    "Caderno de pendências (14/10/2026): C1 (certificado MEI, cartão CNPJ e ficha da JUCESP de 11/10/2026), D6 e J1.10. Inscrição estadual não se aplica. Inscrição municipal: PENDENTE (C1.09). NFS-e pelo portal notafiscal.sorocaba.sp.gov.br.",
};
const vig = must(await db.from("institutional_profiles").select("id, cnpj").eq("status", "vigente").maybeSingle(), "dados institucionais");
if (vig?.cnpj === INSTITUTIONAL.cnpj) console.log("Dados institucionais: versão vigente já publicada.");
else {
  const draft = must(await db.from("institutional_profiles").insert({ ...INSTITUTIONAL, is_test: false }).select("id, version").single(), "rascunho institucional");
  must(await db.rpc("publish_institutional_profile", { p_id: draft.id }), "publicação institucional");
  console.log(`Dados institucionais: versão ${draft.version} publicada.`);
}

// 2) Parâmetros financeiros ---------------------------------------------------------------------------------------
const PARAMS = {
  label: "Parâmetros reais — caderno de pendências (14/10/2026)",
  pro_labore: "3000.00", // pró-labore-alvo (decisão do Diretor, 14/10/2026 — item 6)
  fixed_costs: "310.00", // telefone/internet R$ 240,00 + DAS (MEI) R$ 90,00 (C4)
  billable_hours: "60.00", // D1.01
  taxes: "0", // C2 revisto: 0% — o DAS fixo já está nas despesas fixas (item 5)
  payment_fees: "0", // C5 + item 7: 0% no cálculo; acréscimo de 5% informado para cartão
  commission: "0", // D1.05
  contingency: "0.10", // D1.02
  target_margin: "0.20", // D1.03
  max_discount: "0.10", // D1.04 e D2 (10% em todas as famílias, autorizado pelo Diretor)
  reference_date: "2026-10-12", // D1.06
  validated_by: "Vinicius Rocha Pereira — Diretor", // D1.07 (MEI sem contador — C2.06)
  notes:
    "Despesas fixas: telefone e internet R$ 240,00; DAS (MEI) R$ 90,00. Tributos 0% (DAS fixo nas despesas). Taxas de cobrança 0% no cálculo; pagamento com cartão com acréscimo de 5% informado na proposta. Pró-labore-alvo R$ 3.000,00 (remuneração do tempo do titular, não retirada formal).",
};
const pv = must(await db.from("pricing_parameter_sets").select("id, pro_labore, label").eq("status", "vigente").maybeSingle(), "parâmetros");
if (pv?.label === PARAMS.label) console.log("Parâmetros: versão vigente já publicada.");
else {
  const draft = must(await db.from("pricing_parameter_sets").insert({ ...PARAMS, is_test: false }).select("id, version").single(), "rascunho de parâmetros");
  must(await db.rpc("publish_parameter_set", { p_id: draft.id }), "publicação de parâmetros");
  console.log(`Parâmetros: versão ${draft.version} publicada (custo/hora = (3.000 + 310) ÷ 60 = R$ 55,17).`);
}

// 3) Catálogo (D3/D4) -------------------------------------------------------------------------------------------------
const REF = "Caderno de pendências — D3/D4 (decisão do Diretor, 14/10/2026)";
const TST = "Registro MTE de Técnico em Segurança do Trabalho nº 0120523 (cartão de 2023, considerado válido pelo Diretor)";
const MODELOS = "modelos operacionais AUDDOC018 (Rev.00, 12/10/2026) na Biblioteca";
const PRATICA = "prática realizada na estrutura do cliente (sem infraestrutura própria — D4)";
const LIBERAR = {
  "SST-001": `${TST}; escopo e regime de prestação definidos em contrato; não substitui o SESMT dimensionado pela NR-4 (verificado por cliente).`,
  "SST-002": `${TST}; checklist AUDDOC018-ANX05 e relatório AUDDOC018-ANX09.`,
  "SST-003": `${TST}; material de DDS e campanhas; palestras não substituem treinamentos obrigatórios.`,
  "SST-004": `${TST}; NR-6; ficha de entrega de EPI AUDDOC018-ANX08; o fornecimento continua obrigação do empregador.`,
  "SST-005": `${TST}; modelo de OS de SST AUDDOC018-ANX10; emissão e validação pelo empregador.`,
  "SST-006": `${TST}; NR-5; treinamento dos cipeiros pelo TRN-003/TRN-NR05.`,
  "SST-007": `${TST}; IT do Corpo de Bombeiros/SP verificada por edificação; treinamento prático de brigada fora do escopo (TRN-004 não liberado).`,
  "SST-008": `${TST}; IT aplicável por instalação; se exigir profissional habilitado específico, fica fora do escopo.`,
  "SST-009": `${TST}; relatório técnico AUDDOC018-ANX09 com ressalvas e assinatura do RT.`,
  "SST-010": `${TST}; acesso aos dados autorizado pelo cliente; LGPD conforme M04.`,
  "DOC-001": `${TST}; apoio ao PGR (a responsabilidade é da organização — NR-1); avaliações especializadas excluídas (ESP).`,
  "DOC-002": `${TST}; APR AUDDOC018-ANX07.`,
  "DOC-003": `${TST}; triagem ergonômica (NR-17); AET aprofundada fora do escopo (ESP-005).`,
  "TRN-001": `${TST}; instrutor com proficiência declarada (D4); ${MODELOS}.`,
  "TRN-002": `${TST}; NR-6; ${MODELOS}.`,
  "TRN-003": `${TST}; NR-5; ${MODELOS}.`,
  "TRN-005": `Portfólio liberado oferta a oferta (TRN-NR*); ${TST}; ${MODELOS}.`,
  "AUD-001": `${TST}; checklists e independência por escopo; relatório com o texto padrão de limitação (não é certificação).`,
  "AUD-002": `Certificado de interpretação ISO (24 h) e comprovações consideradas válidas pelo Diretor (D4); independência por escopo.`,
  "AUD-003": `Competência conforme AUD-001/AUD-002; declaração de imparcialidade por fornecedor auditado.`,
  "AUD-004": `Competência conforme AUD-002; linguagem comercial restrita a "diagnóstico preparatório", sem promessa de certificação.`,
  "AMB-001": `${TST}; controle documental e de vencimentos; não inclui documentos que exijam profissional habilitado.`,
  "AMB-002": `${TST}; regras estaduais por cliente; não assume responsabilidade técnica por plano de resíduos.`,
  "SIS-001": `Decisão do Diretor (D3). Preço SaaS ainda sem modelo definido (AUDDOC011 §6): sem cálculo automático.`,
  "SIS-002": `Decisão do Diretor (D3). Preço SaaS ainda sem modelo definido (AUDDOC011 §6): sem cálculo automático.`,
  "TRN-NR01": `${TST}; integração/orientação — não vendida como "NR-01" genérica; ${MODELOS}.`,
  "TRN-NR06": `${TST}; NR-6; ${MODELOS}.`,
  "TRN-NR05": `${TST}; NR-5 (inclui prevenção ao assédio); ${MODELOS}.`,
  "TRN-NR11-E": `${TST}; considerado apto pelo Diretor (D4); ${PRATICA}; ${MODELOS}.`,
  "TRN-NR11-P": `${TST}; considerado apto pelo Diretor (D4); ${PRATICA}; ${MODELOS}.`,
  "TRN-NR17": `${TST}; NR-17; não se confunde com AET; ${MODELOS}.`,
  "TRN-NR20": `${TST}; enquadramento da instalação e da função verificado por cliente; ${MODELOS}.`,
  "TRN-NR26A": `${TST}; NR-26; ${MODELOS}.`,
  "TRN-NR26B": `${TST}; GHS, rotulagem e FDS dos produtos do cliente; ${MODELOS}.`,
  "TRN-NR23": `${TST}; orientações de prevenção e evacuação; não substitui o treinamento de brigada (TRN-004); ${MODELOS}.`,
  "TRN-NR33": `${TST}; considerado apto pelo Diretor (D4); ${PRATICA}; treinamento presencial com avaliação teórica e prática; ${MODELOS}.`,
  "TRN-NR35": `${TST}; considerado apto pelo Diretor (D4); ${PRATICA}; avaliação e procedimento de emergência; ${MODELOS}.`,
};
const services = must(await db.from("services").select("id, service_code, commercial_status"), "catálogo");
let changed = 0;
for (const s of services) {
  const basis = LIBERAR[s.service_code];
  if (!basis || s.commercial_status === "apto_comercialmente") continue;
  must(
    await db
      .from("services")
      .update({
        commercial_status: "apto_comercialmente",
        status_basis: `${basis} Decisão do Diretor em 14/10/2026.`,
        status_reference: REF,
        docs_received: "sim",
        rt_confirmed: "sim",
        resources_confirmed: "sim",
      })
      .eq("id", s.id),
    s.service_code,
  );
  changed++;
}
const missing = Object.keys(LIBERAR).filter((c) => !services.some((s) => s.service_code === c));
if (missing.length) throw new Error(`Códigos não encontrados no catálogo: ${missing.join(", ")}`);
console.log(`Catálogo: ${changed} serviço(s) liberado(s) agora; TRN-004 e ESP-001 a ESP-007 continuam "Não liberado" (AUDDOC004 e D3).`);
