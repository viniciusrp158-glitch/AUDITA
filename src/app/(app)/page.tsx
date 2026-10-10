import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";

export const metadata = { title: "Início" };

type Status = "concluido" | "em_validacao" | "previsto";

// Andamento do desenvolvimento (S0 — plano aprovado). Não são indicadores de negócio.
const INCREMENTOS: { id: string; titulo: string; status: Status }[] = [
  { id: "I1", titulo: "Fundação: login, permissões, layout e trilha de auditoria", status: "concluido" },
  { id: "I2", titulo: "Clientes, unidades e contatos com código permanente", status: "concluido" },
  { id: "I2.1", titulo: "Autocadastro do cliente por link individual", status: "concluido" },
  { id: "I3", titulo: "Catálogo de serviços (AUDDOC004/005) e situação de liberação", status: "concluido" },
  { id: "I4", titulo: "Demandas — Registro Único de Atendimento", status: "concluido" },
  { id: "I5", titulo: "Parâmetros financeiros e motor de cálculo AUDDOC011", status: "concluido" },
  { id: "I6", titulo: "Revisões e emissão de propostas (DOCX/PDF)", status: "em_validacao" },
  { id: "I7", titulo: "Biblioteca documental", status: "previsto" },
  { id: "I8", titulo: "Indicadores gerenciais", status: "previsto" },
  { id: "I9", titulo: "Homologação do MVP", status: "previsto" },
];

const STATUS = {
  concluido: { label: "Concluído", icon: CheckCircle2, cls: "text-ok" },
  em_validacao: { label: "Em validação", icon: CircleDot, cls: "text-warn" },
  previsto: { label: "Previsto", icon: Circle, cls: "text-muted" },
} as const;

export default async function InicioPage() {
  const user = await requireAppUser();
  const primeiroNome = user.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Olá, ${primeiroNome}`}
        description="Os indicadores comerciais (clientes, propostas, valores) serão exibidos aqui a partir dos registros reais, quando os módulos correspondentes estiverem concluídos."
      />

      <section className="rounded-xl border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">
          Andamento do desenvolvimento
        </h2>
        <ol className="divide-y divide-line">
          {INCREMENTOS.map((inc) => {
            const s = STATUS[inc.status];
            const Icon = s.icon;
            return (
              <li key={inc.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-7 font-mono text-xs font-semibold text-muted">{inc.id}</span>
                <span className="flex-1 text-ink">{inc.titulo}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${s.cls}`}>
                  <Icon size={15} aria-hidden /> {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
