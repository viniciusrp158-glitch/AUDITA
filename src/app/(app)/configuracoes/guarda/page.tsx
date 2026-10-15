import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { formatDate, formatDay } from "@/lib/format";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { anonymizeAction } from "./actions";
import { AnonymizeForm } from "./anon-form";

export const metadata = { title: "Guarda e anonimização" };

type Rule = { code: string; category: string; retention: string; basis: string; disposal: string; approved_on: string; approved_by: string };
type Candidate = { kind: string; record_id: string; rule_code: string; label: string; due_since: string };

/** Prazos de guarda aprovados (caderno J4) e registros vencidos para anonimização — nada é automático nem excluído. */
export default async function GuardaPage() {
  const user = await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const [{ data: rules }, { data: candidates }] = await Promise.all([
    supabase.from("retention_rules").select("code, category, retention, basis, disposal, approved_on, approved_by").order("code"),
    user.isMaster ? supabase.rpc("anonymization_candidates") : Promise.resolve({ data: [] }),
  ]);
  const list = (candidates ?? []) as Candidate[];
  return (
    <>
      <Link href="/configuracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Configurações
      </Link>
      <PageHeader
        title="Guarda e anonimização"
        description="Prazos aprovados pelo Diretor (caderno J4). Vencido o prazo, os dados pessoais são anonimizados — nunca excluídos — por decisão do usuário mestre, um registro por vez."
      />
      <Card title="Registros com prazo vencido">
        {!user.isMaster ? (
          <p className="text-sm text-muted">Somente o usuário mestre vê e anonimiza registros vencidos.</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted" data-testid="anon-empty">
            Nenhum registro com prazo de guarda vencido.
          </p>
        ) : (
          <ul className="divide-y divide-line" data-testid="anon-candidates">
            {list.map((c) => (
              <li key={c.record_id} className="py-3">
                <p className="text-sm font-semibold text-ink">{c.label}</p>
                <p className="text-xs text-muted">
                  {c.rule_code} · prazo vencido em {formatDate(c.due_since)}
                </p>
                <AnonymizeForm action={anonymizeAction.bind(null, c.kind, c.record_id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="mt-6 space-y-3" data-testid="retention-rules">
        {((rules ?? []) as Rule[]).map((r) => (
          <Card key={r.code} title={`${r.code} — ${r.category}`}>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Prazo</dt>
                <dd className="mt-0.5 text-ink">{r.retention}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Fundamento</dt>
                <dd className="mt-0.5 text-ink">{r.basis}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Ao vencer</dt>
                <dd className="mt-0.5 text-ink">{r.disposal}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              Aprovado por {r.approved_by} em {formatDay(r.approved_on)}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
