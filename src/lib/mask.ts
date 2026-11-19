/**
 * Máscaras de digitação dos formulários (Frente A, A9): formatam enquanto a pessoa digita. O servidor continua aceitando
 * com ou sem pontuação (as validações tiram os separadores), então a máscara é só ajuda visual.
 */
export type MaskKind = "cnpj" | "cpf" | "taxid" | "phone" | "cep" | "cnae";

const digits = (v: string) => v.replace(/\D/g, "");

/** Aplica um padrão com "#" (um dígito) aos caracteres disponíveis, sem completar o que falta. */
function pattern(value: string, mask: string): string {
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (i >= value.length) break;
    if (ch === "#") out += value[i++];
    else out += ch;
  }
  return out;
}

export function applyMask(kind: MaskKind, raw: string): string {
  switch (kind) {
    case "cnpj": {
      // CNPJ alfanumérico (a partir de 2026): 12 caracteres alfanuméricos + 2 dígitos verificadores
      const v = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 14);
      return pattern(v, "##.###.###/####-##");
    }
    case "cpf":
      return pattern(digits(raw).slice(0, 11), "###.###.###-##");
    case "taxid": {
      const v = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
      return /[A-Z]/.test(v) || v.length > 11 ? applyMask("cnpj", v) : applyMask("cpf", v);
    }
    case "phone": {
      let d = digits(raw);
      if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
      d = d.slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : "";
      return d.length === 11 ? pattern(d, "(##) #####-####") : pattern(d, "(##) ####-####");
    }
    case "cep":
      return pattern(digits(raw).slice(0, 8), "#####-###");
    case "cnae":
      return pattern(digits(raw).slice(0, 7), "####-#/##");
  }
}
