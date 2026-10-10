import { Suspense } from "react";
import { EnvBadge } from "@/components/brand";
import { NoPermissionNotice } from "@/components/no-permission";
import { Sidebar } from "@/components/sidebar";
import { requireAppUser } from "@/lib/auth";
import { countPendingRequests } from "@/lib/clients/queries";
import { getThemeCookie } from "@/lib/theme";

// Todas as páginas internas exigem usuário autorizado (verificação no servidor, a cada requisição).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAppUser();
  const [pending, cookieTheme] = await Promise.all([
    user.role === "marketing" ? Promise.resolve(0) : countPendingRequests(),
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
          badges={{ "/clientes": pending }}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
          <Suspense fallback={null}>
            <NoPermissionNotice />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
