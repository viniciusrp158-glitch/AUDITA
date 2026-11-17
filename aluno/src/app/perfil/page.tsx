import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AreaAluno } from "../shell";
import { PerfilForm, type Perfil } from "./form";

export const metadata = { title: "Meu Perfil" };
export const dynamic = "force-dynamic";

const COLUNAS =
  "full_name, email, cpf, birth_date, phone, company, job_title, address_cep, address_street, address_number, address_complement, address_district, address_city, address_state, email_notices";

/** Meu Perfil (Audita Academy, etapa 5): dados do certificado, contato, endereço e avisos. */
export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data } = await supabase.from("training_students").select(COLUNAS).eq("user_id", user.id).maybeSingle();
  const p = data as Perfil | null;
  if (!p) redirect("/meus-cursos");
  const essenciais = [p.full_name, p.cpf, p.birth_date, p.phone, p.address_cep, p.address_street, p.address_number, p.address_city, p.address_state];
  const pct = Math.round((essenciais.filter(Boolean).length / essenciais.length) * 100);
  const faltam = [
    !p.cpf && "CPF",
    !p.birth_date && "data de nascimento",
    !p.phone && "celular",
    !(p.address_cep && p.address_street && p.address_number && p.address_city && p.address_state) && "endereço",
  ].filter(Boolean) as string[];

  return (
    <AreaAluno ativo="perfil" largura="max-w-4xl">
      <div>
        <h1 className="font-display text-[28px] leading-tight font-extrabold text-navy">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted">Estes dados aparecem no certificado e são usados para falar com você.</p>
      </div>
      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-5" aria-label="Perfil preenchido">
        <p className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-semibold text-ink">Perfil {pct}% preenchido</span>
          {faltam.length > 0 && <span className="text-muted">Falta: {faltam.join(", ")}</span>}
        </p>
        <span className="block h-2 overflow-hidden rounded-full bg-chip" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-green-dark),var(--color-green))]" style={{ width: `${pct}%` }} />
        </span>
      </section>
      <PerfilForm p={p} />
      <p className="text-xs text-muted">
        Seus dados são usados só para o certificado, o contato sobre os cursos e os comprovantes. Veja a{" "}
        <Link href="/privacidade" className="underline underline-offset-2">
          política de privacidade
        </Link>
        .
      </p>
    </AreaAluno>
  );
}
