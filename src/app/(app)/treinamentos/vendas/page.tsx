import Link from "next/link";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/page";
import { requireAppUser } from "@/lib/auth";
import { ADMIN_ONLY } from "@/lib/permissions";
import { formatCnpj } from "@/lib/br";
import { formatDateTime } from "@/lib/format";
import { formatBRL } from "@/lib/pricing/engine";
import { createClient } from "@/lib/supabase/server";
import { saveSalesSettingsAction, savePaymentSecretAction } from "./actions";
import { SalesSettingsForm, SalesSwitch, SecretForm } from "./forms";

export const metadata = { title: "Vendas · Treinamentos" };

type Settings = {
  sales_enabled: boolean;
  seller_name: string | null;
  seller_document: string | null;
  support_email: string | null;
  support_phone: string | null;
  require_cpf: boolean;
  terms_text: string | null;
  privacy_text: string | null;
  terms_updated_at: string | null;
  mp_token_hint: string | null;
  mp_secret_hint: string | null;
};
type Order = {
  id: string;
  created_at: string;
  course_code: string;
  buyer_name: string;
  buyer_email: string;
  amount: number;
  status: "pendente" | "aprovado" | "recusado" | "cancelado" | "estornado";
  mp_payment_id: string | null;
  mp_payment_method: string | null;
  enrollment_id: string | null;
  course_id: string;
};

const STATUS: Record<Order["status"], { label: string; cls: string }> = {
  pendente: { label: "Aguardando pagamento", cls: "bg-warn/10 text-warn" },
  aprovado: { label: "Pago", cls: "bg-ok/10 text-ok" },
  recusado: { label: "Recusado", cls: "bg-danger/10 text-danger" },
  cancelado: { label: "Cancelado", cls: "bg-surface text-muted" },
  estornado: { label: "Estornado", cls: "bg-danger/10 text-danger" },
};

const WEBHOOK = process.env.MP_WEBHOOK_PUBLIC_URL ?? "https://audita.seg.br/pagamentos/mercadopago";

export default async function VendasPage() {
  await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const [{ data: s }, { data: orders }, { data: onSale }] = await Promise.all([
    supabase
      .from("training_sales_settings")
      .select("sales_enabled, seller_name, seller_document, support_email, support_phone, require_cpf, terms_text, privacy_text, terms_updated_at, mp_token_hint, mp_secret_hint")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("training_orders")
      .select("id, created_at, course_code, buyer_name, buyer_email, amount, status, mp_payment_id, mp_payment_method, enrollment_id, course_id")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("training_courses").select("course_code").eq("on_sale", true).eq("status", "ativo"),
  ]);
  const st = s as Settings | null;
  if (!st) return <p className="text-sm text-danger">Configurações de venda não encontradas.</p>;
  const checks = [
    { ok: Boolean(st.seller_name && st.seller_document), label: "Vendedor: razão social e CNPJ" },
    { ok: Boolean(st.support_email || st.support_phone), label: "Contato de suporte" },
    { ok: Boolean(st.terms_text), label: "Termos de uso e de compra" },
    { ok: Boolean(st.privacy_text), label: "Política de privacidade" },
    { ok: Boolean(st.mp_token_hint), label: "Access Token do Mercado Pago" },
    { ok: Boolean(st.mp_secret_hint), label: "Assinatura secreta das notificações" },
  ];
  const ready = checks.every((c) => c.ok);
  const courses = (onSale ?? []).map((c) => c.course_code as string);
  const rows = (orders ?? []) as Order[];

  return (
    <>
      <p className="mb-2 text-sm text-muted">
        <Link href="/treinamentos" className="hover:text-navy">
          Treinamentos
        </Link>{" "}
        › Vendas
      </p>
      <PageHeader
        title="Vendas e vitrine"
        description="Vitrine pública em audita.seg.br/treinamentos/cursos e pagamento pelo Mercado Pago (Pix, cartão e boleto). Quando o pagamento é aprovado, o aluno recebe o convite e a matrícula sai sozinha."
      />

      <div className="mb-5 flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[2_1_480px] flex-col gap-3 rounded-xl border border-line bg-white p-5" data-testid="sales-status">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">{st.sales_enabled ? "Vendas abertas" : "Vendas fechadas"}</h2>
            <SalesSwitch open={st.sales_enabled} ready={ready} />
          </div>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.label} className={`flex items-start gap-2 ${c.ok ? "text-ok" : "text-warn"}`}>
                {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> : <CircleDashed size={16} className="mt-0.5 shrink-0" aria-hidden />}
                {c.label}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Na vitrine:{" "}
            {courses.length
              ? courses.join(", ")
              : "nenhum treinamento. Marque “Mostrar na vitrine” na aba Venda e preço do treinamento (precisa de versão publicada e preço)."}
          </p>
        </section>
        <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-xl border border-line bg-white p-5" data-testid="mp-credentials">
          <h2 className="text-base font-semibold text-ink">Mercado Pago</h2>
          <p className="text-sm text-muted">
            Em Suas integrações › sua aplicação (Checkout Pro). As credenciais ficam guardadas criptografadas no servidor; aqui aparece só o final.
          </p>
          <SecretForm
            action={savePaymentSecretAction.bind(null, "mp_access_token")}
            label="Access Token"
            hint="Credenciais de produção (APP_USR-…). Para testar, use as de teste (TEST-…)."
            current={st.mp_token_hint}
            testId="mp-token"
          />
          <SecretForm
            action={savePaymentSecretAction.bind(null, "mp_webhook_secret")}
            label="Assinatura secreta (Webhooks)"
            hint="Em Webhooks › Configurar notificações, evento Pagamentos."
            current={st.mp_secret_hint}
            testId="mp-secret"
          />
          <div className="rounded-md bg-surface px-3 py-2 text-sm">
            <p className="font-semibold text-ink">URL para cadastrar nas notificações (Webhooks)</p>
            <p className="break-all font-mono text-xs text-ink" data-testid="webhook-url">
              {WEBHOOK}
            </p>
          </div>
        </section>
      </div>

      <section className="mb-5 max-w-4xl rounded-xl border border-line bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">Vendedor, suporte e textos legais</h2>
        <SalesSettingsForm
          action={saveSalesSettingsAction}
          initial={{
            seller_name: st.seller_name ?? "",
            seller_document: st.seller_document ? formatCnpj(st.seller_document) : "",
            support_email: st.support_email ?? "",
            support_phone: st.support_phone ?? "",
            require_cpf: st.require_cpf ? "on" : "",
            terms_text: st.terms_text ?? "",
            privacy_text: st.privacy_text ?? "",
          }}
        />
        {st.terms_updated_at && <p className="mt-3 text-xs text-muted">Textos legais atualizados em {formatDateTime(st.terms_updated_at)}. Cada pedido guarda a versão aceita.</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-white" data-testid="orders">
        <h2 className="border-b border-line px-5 py-3 text-base font-semibold text-ink">Pedidos ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Nenhum pedido ainda.</p>
        ) : (
          <ul>
            {rows.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3 text-sm last:border-b-0">
                <span className="w-32 shrink-0 text-xs text-muted">{formatDateTime(o.created_at)}</span>
                <span className="min-w-0 flex-[2_1_220px]">
                  <span className="block truncate font-semibold text-ink">{o.buyer_name}</span>
                  <span className="block truncate text-xs text-muted">{o.buyer_email}</span>
                </span>
                <span className="w-16 font-semibold text-navy">{o.course_code}</span>
                <span className="w-24 text-right tabular-nums">{formatBRL(o.amount)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                <span className="text-xs text-muted">
                  {o.mp_payment_id ? `MP ${o.mp_payment_id}${o.mp_payment_method ? ` · ${o.mp_payment_method}` : ""}` : ""}
                  {o.enrollment_id ? " · matrícula liberada" : ""}
                </span>
                {o.enrollment_id && (
                  <Link href={`/treinamentos/${o.course_id}?aba=alunos`} className="text-xs font-semibold text-navy hover:underline">
                    Ver aluno
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
