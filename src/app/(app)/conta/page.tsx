import Link from "next/link";
import { Crown, KeyRound, Lock, Palette, UserRound, UsersRound } from "lucide-react";
import { Alert } from "@/components/form";
import { requireAppUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/permissions";
import { getThemeCookie } from "@/lib/theme";
import { createUserAction, listManagedUsers, resetPasswordAction, updateAccessAction, updateProfileAction } from "./actions";
import { AccessForm, CreateUserForm, ProfileForm, ResetPasswordForm, ThemeChoice } from "./conta-forms";

export const metadata = { title: "Minha conta" };

function Section({
  icon: Icon,
  title,
  description,
  children,
  testid,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-6" data-testid={testid} aria-label={title}>
      <div className="mb-4 flex items-start gap-3">
        <Icon size={22} className="mt-0.5 shrink-0 text-muted" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function MasterBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-semibold text-navy" data-testid="master-badge">
      <Crown size={13} className="text-green-dark" aria-hidden /> Usuário mestre
    </span>
  );
}

export default async function ContaPage() {
  const user = await requireAppUser();
  const theme = user.theme ?? (await getThemeCookie());
  const managed = user.isMaster ? await listManagedUsers() : null;

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Minha conta</h1>
          {user.isMaster && <MasterBadge />}
        </div>
        <p className="mt-1 text-sm text-muted">Suas informações, aparência, segurança{user.isMaster ? " e os usuários do sistema AUDITA" : ""}.</p>
      </div>

      <div className="space-y-6">
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4 sm:p-6" aria-label="Resumo da conta">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface text-navy" aria-hidden>
            <UserRound size={30} />
          </span>
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold text-ink" data-testid="account-name">
              {user.fullName}
            </p>
            <p className="break-all text-sm text-muted">{user.email}</p>
            <p className="mt-1 text-sm text-muted">
              {user.jobTitle ? `${user.jobTitle} · ` : ""}
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </section>

        <Section icon={UserRound} title="Informações da conta" description="Mantenha seus dados atualizados.">
          <ProfileForm action={updateProfileAction} initial={{ full_name: user.fullName, job_title: user.jobTitle }} />
          <div className="mt-4 rounded-md bg-surface px-3 py-2 text-sm">
            <span className="text-muted">E-mail de acesso: </span>
            <strong className="break-all text-ink">{user.email}</strong>
            <p className="mt-1 text-xs text-muted">
              A troca de e-mail exige confirmação por mensagem e depende do envio de e-mails com domínio próprio (pendência D8 do caderno).
              Até lá, o usuário mestre recria o acesso se for preciso.
            </p>
          </div>
        </Section>

        <Section icon={Palette} title="Aparência" description="Tema da interface. Também pode ser trocado no canto inferior do menu.">
          <ThemeChoice initial={theme} />
          <p className="mt-2 text-xs text-muted">Propostas e documentos emitidos (PDF/Word) não mudam com o tema.</p>
        </Section>

        <Section icon={Lock} title="Segurança" description="Gerencie sua senha de acesso ao sistema.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
            <div className="flex items-start gap-3">
              <KeyRound size={18} className="mt-0.5 text-muted" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">Alterar senha</p>
                <p className="text-xs text-muted">Mínimo de 12 caracteres, com letras e números.</p>
              </div>
            </div>
            <Link
              href="/atualizar-senha"
              className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-navy/40"
            >
              Alterar
            </Link>
          </div>
        </Section>

        {user.isMaster && managed && (
          <Section
            icon={UsersRound}
            title="Gerenciamento de usuários"
            description="Crie e gerencie quem acessa o sistema. Disponível apenas para o usuário mestre."
            testid="users-section"
          >
            {managed.error && <Alert kind="error">{managed.error}</Alert>}
            <div className="mb-6 rounded-lg border border-line p-4">
              <h3 className="mb-1 text-sm font-semibold text-ink">Novo usuário</h3>
              <p className="mb-4 text-xs text-muted">
                Os níveis seguem o AUDDOC017 §10 no modo mais restritivo (decisão de 10/10/2026): o que ainda está em aberto na matriz D7 do
                caderno de pendências fica sem acesso até a sua resposta.
              </p>
              <CreateUserForm action={createUserAction} />
            </div>

            <h3 className="mb-2 text-sm font-semibold text-ink">Usuários ({managed.users.length})</h3>
            <ul className="space-y-3" data-testid="users-list">
              {managed.users.map((u) => (
                <li key={u.user_id} className="rounded-lg border border-line p-3" data-testid="user-row">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-ink">
                        {u.full_name}
                        {u.status === "inactive" && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">Inativo</span>}
                        {u.is_test && <span className="ml-2 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">TESTE</span>}
                      </p>
                      <p className="break-all text-xs text-muted">{u.email ?? "—"}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {u.job_title ? `${u.job_title} · ` : ""}
                        {u.is_master || u.is_test_master ? "Usuário mestre" : ROLE_LABEL[u.role]}
                        {u.must_change_password ? " · troca de senha pendente" : ""}
                        {u.last_sign_in_at ? ` · último acesso ${formatDateTime(u.last_sign_in_at)}` : " · ainda não acessou"}
                      </p>
                    </div>
                  </div>
                  {!(u.is_master || u.is_test_master) && (
                    <div className="mt-3 grid gap-3 border-t border-line pt-3 lg:grid-cols-2">
                      <AccessForm action={updateAccessAction.bind(null, u.user_id)} role={u.role} status={u.status} />
                      <ResetPasswordForm action={resetPasswordAction.bind(null, u.user_id)} />
                      <p className="text-xs text-muted lg:col-span-2">{ROLE_HINT[u.role]}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Usuários não são excluídos: inative quem não deve mais acessar (o histórico de ações continua preservado).
            </p>
          </Section>
        )}
      </div>
    </>
  );
}
