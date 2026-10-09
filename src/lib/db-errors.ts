/** Traduz erros do Postgres/PostgREST em mensagens claras, sem expor detalhes internos. */
export function dbErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Erro desconhecido.";
  switch (error.code) {
    case "23505":
      if (error.message?.includes("tax_id")) return "Já existe um cadastro com este CNPJ/CPF.";
      if (error.message?.includes("client_units_name")) return "Já existe uma unidade com este nome para o cliente.";
      if (error.message?.includes("one_primary")) return "Já existe um contato principal ativo para este cliente.";
      return "Registro duplicado.";
    case "23514":
      if (error.message?.includes("não pertence")) return "A unidade informada não pertence a este cliente.";
      return "Algum dado não atende às regras de validação. Revise os campos.";
    case "42501":
      return error.message?.includes("permanente")
        ? "O código do cliente é permanente e não pode ser alterado."
        : "Você não tem permissão para esta operação.";
    case "PGRST116":
      return "Registro não encontrado.";
    default:
      return "Não foi possível salvar. Tente novamente.";
  }
}
