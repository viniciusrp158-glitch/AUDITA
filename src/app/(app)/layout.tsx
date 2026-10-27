import { Suspense } from "react";
import { EnvBadge } from "@/components/brand";
import { ClearFlashParams } from "@/components/clear-flash";
import { NoPermissionNotice } from "@/components/no-permission";
import { Sidebar } from "@/components/sidebar";
import { requireAppUser } from "@/lib/auth";
import { countPendingRequests } from "@/lib/clients/queries";
import { countWaitingTooLong } from "@/lib/demands/queries";
import { OPERATE } from "@/lib/permissions";
import { getThemeCookie } from "@/lib/theme";

// Todas as páginas internas exigem usuário autorizado (verificação no servidor, a cada requisição).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAppUser();
  const [pending, waiting, cookieTheme] = await Promise.all([
    user.role === "admin" ? countPendingRequests() : Promise.resolve(0),
    OPERATE.includes(user.role) ? countWaitingTooLong() : Promise.resolve(0),
    getThemeCookie(),
  ]);
  return (
    <div className="min-h-screen">
      <EnvBadge />
      <div className="lg:flex">
        <Sidebar
          userName={user.fullName}
          userEmail={user.email}
          role={user.role}
          isMaster={user.isMaster}
          theme={cookieTheme}
          badges={{ "/clientes": pending, "/demandas": waiting }}
          badgeTitles={{
            "/clientes": `${pending} solicitação(ões) de cadastro pendente(s)`,
            "/demandas": `${waiting} demanda(s) aguardando o cliente há mais de 48 horas`,
          }}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          <Suspense fallback={null}>
            <NoPermissionNotice />
          </Suspense>
          <ClearFlashParams />
          {children}
        </main>
      </div>
    </div>
  );
}
