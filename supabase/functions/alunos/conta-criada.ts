// Regra do desfazer da matrícula (auditoria de segurança, 25/10/2026): quando o cadastro do aluno falha depois do
// convite, a conta de autenticação só é apagada se foi criada POR ESTA requisição. O convite do GoTrue também devolve,
// sem erro, uma conta que já existia e ainda não confirmou o e-mail (ex.: criada um instante antes por outra matrícula
// ou pela liberação de uma compra); apagar essa conta deixaria o outro aluno sem acesso.
// Sem dependências do Deno: usado pela função "alunos" e pelos testes de unidade.

/** Folga para diferença de relógio entre a função e o servidor de autenticação (mesma máquina). */
export const FOLGA_RELOGIO_MS = 2000;

/** A conta nasceu depois do início deste convite (created_at do GoTrue ≥ início − folga)? */
export function contaCriadaNestaRequisicao(createdAt: string | null | undefined, inicioMs: number, folgaMs = FOLGA_RELOGIO_MS): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t >= inicioMs - folgaMs;
}

/**
 * Pode apagar a conta no desfazer? Só quando esta requisição a criou E nenhum cadastro de aluno aponta para ela
 * (conferido com a chave de serviço depois da falha; se a consulta falhar, conta como referenciada e nada é apagado).
 */
export function podeApagarConta(a: { criadaNestaRequisicao: boolean; referenciadaPorAluno: boolean }): boolean {
  return a.criadaNestaRequisicao && !a.referenciadaPorAluno;
}
