import { LegalPage } from "../legal";

export const metadata = { title: "Política de privacidade" };
export const dynamic = "force-dynamic";

export default function PrivacidadePage() {
  return <LegalPage kind="privacy" />;
}
