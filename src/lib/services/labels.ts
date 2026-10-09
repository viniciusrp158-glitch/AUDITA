/** Situações comerciais — AUDDOC005 §14 (matriz de decisão comercial). */
export const COMMERCIAL_STATUS = {
  nao_liberado: {
    label: "Não liberado",
    cls: "bg-danger/10 text-danger",
    criterio: "Situação atual de todos os serviços; mantém-se na AUDDOC004.",
  },
  apto_tecnicamente: {
    label: "Apto tecnicamente",
    cls: "bg-blue/10 text-navy",
    criterio:
      "Requisitos de atribuição, competência, equipamentos, documentação e práticas verificados e registrados.",
  },
  apto_comercialmente: {
    label: "Apto comercialmente",
    cls: "bg-ok/10 text-ok",
    criterio: "Após regularização PJ, documentação comercial, contratos, preços e validação final.",
  },
  expansao_futura: {
    label: "Expansão futura",
    cls: "bg-surface text-muted",
    criterio: "Dependências não atendidas, exigências de profissionais parceiros ou estrutura adicional.",
  },
} as const;

export type CommercialStatus = keyof typeof COMMERCIAL_STATUS;
export const COMMERCIAL_STATUS_KEYS = Object.keys(COMMERCIAL_STATUS) as CommercialStatus[];

export const CHECK_OPTIONS = {
  docs_received: [
    { value: "nao", label: "Não" },
    { value: "parcial", label: "Parcial" },
    { value: "sim", label: "Sim" },
  ],
  rt_confirmed: [
    { value: "nao", label: "Não" },
    { value: "parcial", label: "Parcial" },
    { value: "sim", label: "Sim" },
    { value: "nao_aplicavel", label: "Não aplicável" },
  ],
  resources_confirmed: [
    { value: "nao", label: "Não" },
    { value: "parcial", label: "Parcial" },
    { value: "sim", label: "Sim" },
    { value: "nao_aplicavel", label: "Não aplicável" },
  ],
} as const;

export function checkLabel(v: string | null | undefined): string {
  return { nao: "Não", parcial: "Parcial", sim: "Sim", nao_aplicavel: "N/A" }[v ?? ""] ?? "—";
}

export const PRICING_MODEL: Record<string, string> = {
  hora_tecnica: "Hora técnica (metodologia AUDDOC011)",
  sem_modelo_definido: "Sem modelo definido (sem cálculo automático)",
};
