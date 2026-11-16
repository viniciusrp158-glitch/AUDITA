import { requireAppUser } from "@/lib/auth";
import { OPERATE } from "@/lib/permissions";
import { ProspectTabs } from "./tabs";

/** AUDITA PROSPECT (AUDDOC020): administrador e operador. */
export default async function ProspeccaoLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser(OPERATE);
  return (
    <>
      <ProspectTabs />
      {children}
    </>
  );
}
