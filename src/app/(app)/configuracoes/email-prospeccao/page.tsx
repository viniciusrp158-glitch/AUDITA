import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Card } from "@/components/ui";
import { requireAppUser } from "@/lib/auth";
import { isProduction } from "@/lib/env";
import { formatDay } from "@/lib/format";
import { ADMIN_ONLY } from "@/lib/permissions";
import { getEmailQuota } from "@/lib/prospect/email-send";
import { secretsConfigured } from "@/lib/secret-box";
import { createClient } from "@/lib/supabase/server";
import { EmailConfigForm } from "./form";

export const metadata = { title: "E-mail da prospecção" };

export default async function EmailProspeccaoPage() {
  await requireAppUser(ADMIN_ONLY);
  const supabase = await createClient();
  const [{ data: cfg }, quota] = await Promise.all([
    supabase.from("prospect_email_config").select("sender_name, sender_email, reply_to, daily_start, daily_max, legal_validated_on, api_key_cipher, updated_at").eq("id", 1).maybeSingle(),
    getEmailQuota(),
  ]);
  const hasKey = Boolean(cfg?.api_key_cipher);
  const steps = [
    { done: Boolean(cfg?.sender_name), label: "Remetente preenchido" },
    { done: hasKey, label: "Chave do Brevo guardada (cifrada)" },
    { done: Boolean(cfg?.legal_validated_on), label: cfg?.legal_validated_on ? `Validação jurídica em ${formatDay(cfg.legal_validated_on)} — lote liberado` : "Validação jurídica (libera o envio em lote)" },
  ];

  return (
    <>
      <Link href="/configuracoes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
        <ArrowLeft size={16} /> Configurações
      </Link>
      <PageHeader
        title="E-mail da prospecção"
        description="Envio do e-mail de apresentação pelo Brevo (conta separada da prospecção). Passo a passo da conta: docs/prospeccao/PASSO_A_PASSO_BREVO.md."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Configuração">
            {!isProduction && (
              <div className="mb-4">
                <Alert kind="warning">Ambiente de testes: nenhum e-mail é enviado de verdade; os envios ficam registrados como simulados.</Alert>
              </div>
            )}
            {!secretsConfigured() && (
              <div className="mb-4">
                <Alert kind="error">O servidor ainda não tem a chave de criptografia (AUDITA_SECRETS_KEY): a chave do Brevo não pode ser guardada.</Alert>
              </div>
            )}
            <EmailConfigForm
              hasKey={hasKey}
              values={{
                sender_name: cfg?.sender_name ?? "",
                sender_email: cfg?.sender_email ?? "prospeccao@audita.seg.br",
                reply_to: cfg?.reply_to ?? "engenharia.audita@outlook.com",
                daily_start: cfg?.daily_start ?? 30,
                daily_max: cfg?.daily_max ?? 100,
                legal_validated_on: cfg?.legal_validated_on ?? "",
              }}
            />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Situação">
            <ul className="space-y-2 text-sm" aria-label="Situação do envio">
              {steps.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  <span aria-hidden>{s.done ? "✅" : "⬜"}</span>
                  <span className={s.done ? "text-ink" : "text-muted"}>{s.label}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Hoje">
            {quota ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Enviados hoje</dt>
                  <dd className="text-xl font-bold tabular-nums">{quota.sent_today}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Limite de hoje</dt>
                  <dd className="text-xl font-bold tabular-nums">{quota.daily_limit}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Devoluções (últimos 100)</dt>
                  <dd className="text-xl font-bold tabular-nums">{(quota.bounce_rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Envio</dt>
                  <dd className={`text-sm font-semibold ${quota.paused ? "text-danger" : "text-ok"}`}>{quota.paused ? "Pausado (> 3%)" : "Normal"}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">Sem informação.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
