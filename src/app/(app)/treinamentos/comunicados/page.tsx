import Link from "next/link";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ADMIN_ONLY } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DESTINOS } from "./destinos";
import { NoticeForm } from "./form";

export const metadata = { title: "Comunicados · Treinamentos" };

type Notice = { id: string; title: string; body: string | null; link: string | null; course_id: string | null; created_at: string };

/** Comunicados aos alunos da Audita Academy (etapa 7 do planejamento aprovado pelo Diretor em 16/11/2026). */
export default async function ComunicadosPage() {
  await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const [{ data: notices }, { data: courses }] = await Promise.all([
    supabase.from("training_notifications").select("id, title, body, link, course_id, created_at").eq("kind", "comunicado").order("created_at", { ascending: false }).limit(100),
    supabase.from("training_courses").select("id, course_code, title").eq("status", "ativo").order("course_code"),
  ]);
  const cursos = ((courses ?? []) as { id: string; course_code: string; title: string }[]).map((c) => ({ id: c.id, label: `${c.course_code} · ${c.title}` }));
  const nomeCurso = new Map(cursos.map((c) => [c.id, c.label]));
  const rows = (notices ?? []) as Notice[];

  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link href="/treinamentos" className="hover:text-navy">
          Treinamentos
        </Link>{" "}
        › Comunicados
      </p>
      <PageHeader
        title="Comunicados aos alunos"
        description="Avisos que aparecem em Notificações na Audita Academy (audita.seg.br/treinamentos), para todos os alunos ou para os alunos de um curso. Os avisos automáticos (curso liberado, avaliação, certificado, pagamento) saem sozinhos."
      />
      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-xl border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink">Novo comunicado</h2>
          <NoticeForm courses={cursos} />
        </section>
        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 rounded-xl border border-line bg-white p-5" data-testid="notices-sent">
          <h2 className="text-base font-semibold text-ink">Enviados</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">Nenhum comunicado enviado.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((n) => (
                <li key={n.id} className="flex flex-col gap-1 py-3">
                  <p className="font-semibold text-ink">{n.title}</p>
                  {n.body && <p className="text-sm whitespace-pre-line text-muted">{n.body}</p>}
                  <p className="text-xs text-muted">
                    {[
                      formatDateTime(n.created_at),
                      n.course_id ? `alunos de ${nomeCurso.get(n.course_id) ?? "um curso"}` : "todos os alunos",
                      n.link && `abre ${DESTINOS.find((d) => d.value === n.link)?.label ?? n.link}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
