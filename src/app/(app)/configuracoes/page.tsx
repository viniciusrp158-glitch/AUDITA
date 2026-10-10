import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page";

export const metadata = { title: "Configurações" };

const ITENS = [
  { href: "/configuracoes/atividades", titulo: "Registro de atividades", desc: "Trilha de alterações e acessos ao sistema.", pronto: true },
  { href: "/configuracoes/institucional", titulo: "Dados institucionais", desc: "Razão social, CNPJ, endereço e contatos da AUDITA (proponente das propostas).", pronto: true },
  { href: "/configuracoes/servicos", titulo: "Catálogo de serviços", desc: "Serviços AUDDOC004/005 e situação de liberação.", pronto: true },
  { href: "/configuracoes/parametros", titulo: "Parâmetros financeiros", desc: "Conjuntos versionados de parâmetros AUDDOC011.", pronto: true },
  { href: "/configuracoes/modelos", titulo: "Modelos de documentos", desc: "Versões técnicas dos modelos AUDDOC010.", pronto: true },
  { href: "/conta", titulo: "Usuários", desc: "Criação e níveis de acesso em “Minha conta” (somente usuário mestre).", pronto: true },
] as const;

export default async function ConfiguracoesPage() {
  await requireAppUser(ADMIN_ONLY);
  return (
    <>
      <PageHeader title="Configurações" description="Parâmetros, cadastros de apoio e registros administrativos." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {ITENS.map((item) => {
          const body = (
            <>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{item.titulo}</p>
                <p className="mt-0.5 text-xs text-muted">{item.desc}</p>
              </div>
              {item.pronto ? (
                <ChevronRight size={18} className="text-muted" />
              ) : (
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                  {"inc" in item ? `Previsto: ${item.inc}` : ""}
                </span>
              )}
            </>
          );
          return (
            <li key={item.titulo}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-navy/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 opacity-80">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
