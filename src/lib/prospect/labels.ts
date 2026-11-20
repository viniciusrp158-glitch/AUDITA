/**
 * AUDITA PROSPECT — etapas do funil, contatos, modelos de mensagem e link do WhatsApp (AUDDOC020 RP-07, RP-09, RP-10).
 * Arquivo puro (usado nas telas e nos testes). O WhatsApp é ASSISTIDO: o sistema só monta o link oficial
 * "clique para conversar" com a mensagem; quem envia é a pessoa, pelo WhatsApp Business da empresa.
 */

export const STAGES = [
  { value: "identificada", label: "Empresa identificada" },
  { value: "importado", label: "Lead importado" },
  { value: "qualificado", label: "Lead qualificado" },
  { value: "primeiro_contato", label: "Primeiro contato realizado" },
  { value: "aguardando_retorno", label: "Aguardando retorno" },
  { value: "negociacao", label: "Em negociação" },
  { value: "reuniao", label: "Reunião agendada" },
  { value: "proposta", label: "Proposta enviada" },
  { value: "cliente", label: "Cliente conquistado" },
  { value: "perdido", label: "Perdido ou desqualificado" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<Stage, string>;
export const isStage = (v: string): v is Stage => STAGES.some((s) => s.value === v);

/** Meta de contatos por dia útil (decisão do Diretor de 19/11/2026; AUDDOC020 Rev.01). */
export const DAILY_GOAL = 20;

export const ACTIVITY_KINDS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "reuniao", label: "Reunião" },
  { value: "anotacao", label: "Anotação" },
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["value"];
export const KIND_LABEL = Object.fromEntries(ACTIVITY_KINDS.map((k) => [k.value, k.label])) as Record<ActivityKind, string>;

export const OUTCOMES = [
  { value: "enviado", label: "Enviado, sem resposta ainda" },
  { value: "interesse", label: "Respondeu: tem interesse" },
  { value: "reuniao_marcada", label: "Reunião marcada" },
  { value: "retornar_depois", label: "Pediu contato depois" },
  { value: "sem_resposta", label: "Não respondeu" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "numero_errado", label: "Contato errado" },
  { value: "realizada", label: "Reunião realizada" },
  { value: "nao_contatar", label: "Pediu para não ser contatado" },
] as const;
export type Outcome = (typeof OUTCOMES)[number]["value"];
export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label])) as Record<Outcome, string>;

/**
 * Modelos de mensagem do primeiro contato (propostos para revisão do Diretor). Sempre identificam a AUDITA e quem
 * escreve e oferecem saída. {empresa} e {remetente} são preenchidos pelo sistema; o texto pode ser editado antes do envio.
 */
export const TEMPLATES = [
  {
    code: "diagnostico_sst",
    name: "Diagnóstico de SST (geral)",
    channels: ["whatsapp", "email"],
    body:
      "Olá! Aqui é {remetente}, da AUDITA | SSMA & SGI, de Sorocaba.\n" +
      "Apoiamos empresas como a {empresa} com segurança do trabalho: diagnóstico de SST, apoio ao PGR, treinamentos de NR e consultoria.\n" +
      "Posso enviar uma proposta de diagnóstico inicial?\n" +
      "Se preferir não receber contatos, é só responder \"sair\".",
  },
  {
    code: "construcao_nr35",
    name: "Construção civil — NR-35 e PGR",
    channels: ["whatsapp", "email"],
    body:
      "Olá! Aqui é {remetente}, da AUDITA | SSMA & SGI, de Sorocaba.\n" +
      "Trabalhamos com construtoras na segurança do trabalho: treinamento de trabalho em altura (NR-35), apoio ao PGR e inspeções de obra.\n" +
      "Podemos conversar sobre as obras da {empresa}?\n" +
      "Se preferir não receber contatos, é só responder \"sair\".",
  },
  {
    code: "logistica_nr11",
    name: "Atacado e logística — NR-11 e NR-35",
    channels: ["whatsapp", "email"],
    body:
      "Olá! Aqui é {remetente}, da AUDITA | SSMA & SGI, de Sorocaba.\n" +
      "Atendemos empresas de armazenagem e distribuição com treinamentos de operação de empilhadeira (NR-11), trabalho em altura (NR-35) e apoio ao PGR.\n" +
      "Posso enviar uma proposta para a {empresa}?\n" +
      "Se preferir não receber contatos, é só responder \"sair\".",
  },
  {
    code: "industria_nr",
    name: "Indústria — treinamentos de NR e PGR",
    channels: ["whatsapp", "email"],
    body:
      "Olá! Aqui é {remetente}, da AUDITA | SSMA & SGI, de Sorocaba.\n" +
      "Apoiamos indústrias de pequeno porte com treinamentos de NR (EPI, ponte rolante, inflamáveis), apoio ao PGR e ordens de serviço de SST.\n" +
      "Podemos conversar sobre as necessidades da {empresa}?\n" +
      "Se preferir não receber contatos, é só responder \"sair\".",
  },
] as const;
export type TemplateCode = (typeof TEMPLATES)[number]["code"];

/** Modelo sugerido pelo nicho do lead. */
export function templateForNiche(nicheCode: string | null | undefined): TemplateCode {
  if (nicheCode === "construcao") return "construcao_nr35";
  if (nicheCode === "atacado_logistica") return "logistica_nr11";
  if (nicheCode === "industria") return "industria_nr";
  return "diagnostico_sst";
}

export function renderTemplate(code: string, vars: { empresa: string; remetente: string }): string {
  const t = TEMPLATES.find((x) => x.code === code) ?? TEMPLATES[0];
  return t.body.replaceAll("{empresa}", vars.empresa).replaceAll("{remetente}", vars.remetente);
}

/**
 * Link oficial do WhatsApp ("clique para conversar"): https://wa.me/<país+DDD+número>?text=<mensagem>.
 * Aceita número brasileiro com DDD (10 ou 11 dígitos) ou já com 55; devolve null se o número não servir.
 */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Celular brasileiro (DDD + 9 + 8 dígitos): só ele pode ter WhatsApp; fixo de 10 dígitos não. */
export const isMobile = (phone: string | null | undefined) => /^(55)?\d{2}9\d{8}$/.test((phone ?? "").replace(/\D/g, ""));
