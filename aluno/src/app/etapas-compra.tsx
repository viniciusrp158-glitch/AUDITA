import { Check } from "lucide-react";

const ETAPAS = ["Seus dados", "Pagamento", "Acesso"];

/** Indicador das etapas da compra (Audita Academy, etapa 3). `atual` começa em 0; etapas anteriores aparecem concluídas. */
export function EtapasCompra({ atual }: { atual: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Etapas da compra">
      {ETAPAS.map((e, i) => {
        const feita = i < atual;
        const agora = i === atual;
        return (
          <li key={e} className={`flex items-center gap-2 text-sm font-semibold ${agora || feita ? "text-ink" : "text-muted"}`} aria-current={agora ? "step" : undefined}>
            <span
              className={`grid size-8 place-items-center rounded-full text-[13px] font-bold ${feita ? "bg-green-dark text-white" : agora ? "bg-green text-navy" : "bg-chip text-muted"}`}
              aria-hidden
            >
              {feita ? <Check size={16} strokeWidth={3} /> : i + 1}
            </span>
            {e}
            {i < ETAPAS.length - 1 && <span className="mx-1 hidden h-px w-8 bg-line sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
