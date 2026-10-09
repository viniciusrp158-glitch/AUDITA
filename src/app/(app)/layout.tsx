import { EnvBadge } from "@/components/brand";
import { Sidebar } from "@/components/sidebar";
import { requireAppUser } from "@/lib/auth";

// Todas as páginas internas exigem usuário autorizado (verificação no servidor, a cada requisição).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAppUser();
  return (
    <div className="min-h-screen">
      <EnvBadge />
      <div className="lg:flex">
        <Sidebar userName={user.fullName} userEmail={user.email} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
