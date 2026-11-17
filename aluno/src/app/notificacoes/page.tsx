import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Award, BellRing, BookCheck, CalendarClock, ClipboardCheck, CreditCard, Megaphone, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AreaAluno } from "../shell";

export const metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

type Aviso = { id: string | null; kind: string; title: string; body: string | null; link: string | null; created_at: string; is_read: boolean | null };

const ICONES: Record<string, typeof BellRing> = {
  liberado: PlayCircle,
  pagamento: CreditCard,
  modulo: BookCheck,
  avaliacao: ClipboardCheck,
  certificado: Award,
  comunicado: Megaphone,
  prazo: CalendarClock,
};

function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const dias = Math.floor((hoje.getTime() - d.getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function marcarTodas() {
  "use server";
  const supabase = await createClient();
  await supabase.rpc("training_mark_notifications_read", { p_ids: null });
  revalidatePath("/notificacoes");
}

/** Notificações (Audita Academy, etapa 7): avisos automáticos, aviso de prazo e comunicados da AUDITA. */
export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("training_my_notifications", { p_limit: 100 });
  const avisos = (data ?? []) as Aviso[];
  const naoLidos = avisos.filter((a) => a.is_read === false).length;

  return (
    <AreaAluno ativo="avisos" largura="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold text-navy">Notificações</h1>
          <p className="mt-1 text-sm text-muted">{naoLidos ? `${naoLidos} não ${naoLidos === 1 ? "lida" : "lidas"}` : "Tudo lido"}</p>
        </div>
        {naoLidos > 0 && (
          <form action={marcarTodas}>
            <button type="submit" className="min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-navy">
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>
      {avisos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          Nenhum aviso por enquanto. Quando houver novidades sobre os seus cursos, elas aparecem aqui.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white" data-testid="avisos">
          {avisos.map((a, i) => {
            const Icone = ICONES[a.kind] ?? BellRing;
            const destino = a.id ? `/notificacoes/ler?id=${a.id}` : a.link;
            const conteudo = (
              <>
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${a.kind === "prazo" ? "bg-late-50 text-warn" : a.is_read === false ? "bg-lime-50 text-green-dark" : "bg-surface text-muted"}`}
                  aria-hidden
                >
                  <Icone size={19} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`text-[15px] ${a.is_read === false ? "font-semibold text-ink" : "text-ink"}`}>{a.title}</span>
                  {a.body && <span className="text-sm text-muted">{a.body}</span>}
                  <span className="text-xs text-muted">{a.kind === "prazo" ? "Aviso de prazo" : quando(a.created_at)}</span>
                </span>
                {a.is_read === false && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-green-dark" aria-label="Não lida" />}
              </>
            );
            return (
              <li key={a.id ?? `prazo-${i}`}>
                {destino ? (
                  <Link href={destino} className="flex gap-4 px-4 py-4 hover:bg-surface sm:px-5">
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex gap-4 px-4 py-4 sm:px-5">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AreaAluno>
  );
}
