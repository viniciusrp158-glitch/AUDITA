import Link from "next/link";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Registro de atividades" };

const ACOES: Record<string, string> = {
  insert: "Inclusão",
  update: "Alteração",
  delete: "Exclusão",
  login: "Entrada no sistema",
  logout: "Saída do sistema",
  access_denied: "Acesso negado",
};

const ENTIDADES: Record<string, string> = {
  app_users: "Usuários",
  session: "Sessão",
};

const PAGE_SIZE = 50;

export default async function AtividadesPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireAppUser();
  const page = Math.max(1, Number((await searchParams).p) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("audit_log")
    .select("id, occurred_at, actor_user_id, action, entity, entity_id, summary", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Registro de atividades"
        description="Registro somente de inclusão: alterações de cadastro e eventos de acesso. Não contém senhas nem tokens."
      />
      {error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          Não foi possível carregar o registro de atividades.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Data e hora</th>
                <th className="px-4 py-2.5 font-semibold">Ação</th>
                <th className="px-4 py-2.5 font-semibold">Área</th>
                <th className="px-4 py-2.5 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink">{formatDateTime(row.occurred_at)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{ACOES[row.action] ?? row.action}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{ENTIDADES[row.entity] ?? row.entity}</td>
                  <td className="px-4 py-2.5">
                    {Object.keys(row.summary ?? {}).length > 0 ? (
                      <code className="block max-w-xl overflow-hidden text-ellipsis whitespace-pre-wrap break-all text-xs text-muted">
                        {JSON.stringify(row.summary)}
                      </code>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                    Nenhuma atividade registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <nav className="mt-4 flex items-center justify-between text-sm text-muted" aria-label="Paginação">
        <span>
          {total} registro{total === 1 ? "" : "s"} · página {page} de {pages}
        </span>
        <span className="flex gap-3">
          {page > 1 && <Link href={`?p=${page - 1}`} className="text-navy hover:underline">Anterior</Link>}
          {page < pages && <Link href={`?p=${page + 1}`} className="text-navy hover:underline">Próxima</Link>}
        </span>
      </nav>
    </>
  );
}
