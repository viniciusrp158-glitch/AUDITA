"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarPerfil, type PerfilState } from "./actions";

export type Perfil = {
  full_name: string;
  email: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  email_notices: boolean;
};

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const campo =
  "min-h-12 w-full min-w-0 rounded-[10px] border-[1.5px] border-line bg-white px-3.5 text-base text-ink outline-none focus:border-green-dark focus:ring-2 focus:ring-green/25 disabled:bg-surface disabled:text-muted";
const rotulo = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink";
const fmtCpf = (v: string | null) => (v && v.length === 11 ? v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : (v ?? ""));
const fmtTel = (v: string | null) =>
  !v ? "" : v.length === 11 ? v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : v.length === 10 ? v.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : v;
const fmtCep = (v: string | null) => (v && v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : (v ?? ""));

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-full bg-green px-8 text-[15px] font-semibold text-navy shadow-[0_6px_18px_rgba(128,187,8,0.35)] hover:bg-[#8cc912] disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

function Bloco({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <legend className="sr-only">{titulo}</legend>
      <div>
        <h2 className="font-display text-lg font-bold text-navy">{titulo}</h2>
        {texto && <p className="mt-0.5 text-sm text-muted">{texto}</p>}
      </div>
      {children}
    </fieldset>
  );
}

/** Formulário do Meu Perfil. O CEP preenche rua, bairro, cidade e UF pelo ViaCEP (o aluno pode corrigir). */
export function PerfilForm({ p }: { p: Perfil }) {
  const [state, action] = useActionState<PerfilState, FormData>(salvarPerfil, {});
  const [cepAviso, setCepAviso] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  async function buscarCep(valor: string) {
    const cep = valor.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepAviso("Buscando o endereço…");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (d.erro) {
        setCepAviso("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      const f = form.current!;
      const set = (n: string, v?: string) => {
        const el = f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
        if (el && v) el.value = v;
      };
      set("rua", d.logradouro);
      set("bairro", d.bairro);
      set("cidade", d.localidade);
      set("uf", d.uf);
      setCepAviso(null);
      (f.elements.namedItem("numero") as HTMLInputElement | null)?.focus();
    } catch {
      setCepAviso("Não foi possível buscar o CEP agora. Preencha o endereço manualmente.");
    }
  }

  return (
    <form ref={form} action={action} className="flex flex-col gap-5" data-testid="perfil-form">
      {state.error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-xl border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {state.ok}
        </p>
      )}

      <Bloco titulo="Dados para o certificado" texto="O nome sai no certificado exatamente como estiver aqui. Certificado já emitido não muda; para corrigir, fale com a AUDITA.">
        <label className={rotulo}>
          Nome completo
          <input name="nome" required minLength={3} maxLength={160} autoComplete="name" defaultValue={p.full_name} className={campo} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            CPF
            <input name="cpf" inputMode="numeric" maxLength={14} defaultValue={fmtCpf(p.cpf)} placeholder="000.000.000-00" className={campo} />
          </label>
          <label className={rotulo}>
            Data de nascimento
            <input name="nascimento" type="date" defaultValue={p.birth_date ?? ""} className={campo} />
          </label>
        </div>
      </Bloco>

      <Bloco titulo="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            E-mail (é o seu login)
            <input value={p.email} disabled readOnly className={campo} />
          </label>
          <label className={rotulo}>
            Celular com WhatsApp
            <input name="telefone" type="tel" autoComplete="tel" maxLength={20} defaultValue={fmtTel(p.phone)} placeholder="(00) 00000-0000" className={campo} />
          </label>
          <label className={rotulo}>
            <span>
              Empresa <span className="font-normal text-muted">(opcional)</span>
            </span>
            <input name="empresa" maxLength={200} autoComplete="organization" defaultValue={p.company ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            <span>
              Cargo <span className="font-normal text-muted">(opcional)</span>
            </span>
            <input name="cargo" maxLength={120} autoComplete="organization-title" defaultValue={p.job_title ?? ""} className={campo} />
          </label>
        </div>
      </Bloco>

      <Bloco titulo="Endereço" texto="Digite o CEP para preencher o resto automaticamente.">
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)_120px]">
          <label className={rotulo}>
            CEP
            <input
              name="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              defaultValue={fmtCep(p.address_cep)}
              placeholder="00000-000"
              onBlur={(e) => buscarCep(e.currentTarget.value)}
              className={campo}
            />
          </label>
          <label className={rotulo}>
            Rua
            <input name="rua" maxLength={200} autoComplete="address-line1" defaultValue={p.address_street ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            Número
            <input name="numero" maxLength={20} defaultValue={p.address_number ?? ""} className={campo} />
          </label>
        </div>
        {cepAviso && (
          <p className="text-sm text-muted" role="status">
            {cepAviso}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px]">
          <label className={rotulo}>
            Complemento
            <input name="complemento" maxLength={120} autoComplete="address-line2" defaultValue={p.address_complement ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            Bairro
            <input name="bairro" maxLength={120} defaultValue={p.address_district ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            Cidade
            <input name="cidade" maxLength={120} autoComplete="address-level2" defaultValue={p.address_city ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            UF
            <select name="uf" defaultValue={p.address_state ?? ""} className={campo}>
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
      </Bloco>

      <Bloco titulo="Avisos">
        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" name="avisos_email" defaultChecked={p.email_notices} className="mt-0.5 size-5 shrink-0 accent-green-dark" />
          <span>
            Aceito receber por e-mail os avisos da plataforma (resultado de avaliação, certificado e prazo de acesso), quando esse envio estiver disponível.
            <span className="block text-sm text-muted">Por enquanto, os avisos aparecem em Notificações.</span>
          </span>
        </label>
      </Bloco>

      <div className="flex flex-wrap items-center gap-4">
        <Salvar />
        <Link href="/definir-senha" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
          Trocar a senha
        </Link>
      </div>
    </form>
  );
}
