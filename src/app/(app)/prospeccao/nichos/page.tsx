import Link from "next/link";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { getNiches, getReleasedServices } from "@/lib/prospect/queries";
import { createClient } from "@/lib/supabase/server";
import { NicheForm } from "./niche-form";

export const metadata = { title: "Nichos e palavras-chave" };

export default async function NichosPage() {
  const supabase = await createClient();
  const [niches, released, groups] = await Promise.all([
    getNiches(true),
    getReleasedServices(),
    supabase.from("prospect_keyword_groups").select("id, name, purpose, status, prospect_keywords(term, status)").order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Nichos e palavras-chave"
        description="Cada nicho liga códigos de CNAE da Receita aos serviços liberados no catálogo. Serviços que deixarem de estar liberados não são sugeridos."
      />
      <div className="mb-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Nicho</th>
              <th className="px-4 py-2.5 font-semibold">CNAE (início do código)</th>
              <th className="px-4 py-2.5 font-semibold">Serviços ligados</th>
              <th className="px-4 py-2.5 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {niches.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-3">
                  <Link href={`/prospeccao/pesquisar?nicho=${n.code}&raio=50&run=1`} className="font-medium text-ink hover:text-navy hover:underline">
                    {n.name}
                  </Link>
                  {n.isEntry && <span className="ml-2 rounded-full bg-ok/10 px-2 py-0.5 text-xs font-semibold text-ok">Entrada</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{n.cnaePrefixes.join(", ")}</td>
                <td className="px-4 py-3">
                  <ul className="flex flex-wrap gap-1.5">
                    {n.serviceCodes.map((c) => (
                      <li
                        key={c}
                        title={released.names.get(c) ?? "Não liberado no catálogo: não é sugerido"}
                        className={`rounded-md border px-1.5 py-0.5 font-mono text-xs ${released.codes.has(c) ? "border-line text-ink" : "border-dashed border-line text-muted line-through"}`}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-muted">{n.status === "ativo" ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-label="Editar nichos" className="mb-6 space-y-2">
        <h2 className="text-sm font-semibold text-ink">Editar ou criar nichos</h2>
        {[...niches, null].map((n) => (
          <details key={n?.id ?? "novo"} className="rounded-xl border border-line bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">{n ? n.name : "+ Novo nicho"}</summary>
            <div className="border-t border-line p-4">
              <NicheForm
                niche={n ?? undefined}
                services={[...released.names].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code))}
              />
            </div>
          </details>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {(groups.data ?? []).map((g) => (
          <Card key={g.id} title={g.name}>
            <p className="mb-3 text-xs text-muted">{g.purpose === "clientes" ? "Encontram clientes" : "Encontram parceiros e concorrentes"}</p>
            <ul className="flex flex-wrap gap-1.5">
              {(g.prospect_keywords ?? [])
                .filter((k: { status: string }) => k.status === "ativo")
                .map((k: { term: string }) => (
                  <li key={k.term} className="rounded-full border border-line bg-surface/50 px-2.5 py-1 text-xs text-ink">
                    {k.term}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
