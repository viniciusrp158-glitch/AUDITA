/** CPF com os 3 primeiros e os 2 últimos dígitos ocultos (LGPD), para documentos do aluno: ***.456.789-** */
export function maskCpf(cpf: string | null | undefined): string | null {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
