/** Apoio do Histórico de cursos (situação da matrícula e datas). */
export type MatriculaHist = {
  id: string;
  status: "ativa" | "suspensa" | "cancelada" | "concluida";
  starts_on: string;
  access_until: string | null;
  access_revoked_at: string | null;
  completed_at: string | null;
  training_courses: { course_code: string; title: string } | null;
  training_versions: { title: string; workload_minutes: number | null } | null;
};

export const dataBR = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

export function situacao(m: MatriculaHist) {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (m.access_revoked_at) return { rotulo: "Acesso encerrado", tom: "cinza" };
  if (m.status === "concluida") return { rotulo: "Concluído", tom: "verde" };
  if (m.status === "suspensa") return { rotulo: "Suspenso", tom: "cinza" };
  if (m.status === "cancelada") return { rotulo: "Cancelado", tom: "cinza" };
  if (m.access_until && m.access_until < hoje) return { rotulo: "Prazo encerrado", tom: "cinza" };
  return { rotulo: "Em andamento", tom: "amarelo" };
}

export const TOM: Record<string, string> = {
  verde: "bg-ok/10 text-ok",
  amarelo: "bg-late-50 text-warn",
  cinza: "bg-surface text-muted",
};
