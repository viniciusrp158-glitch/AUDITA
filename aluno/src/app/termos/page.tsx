import { LegalPage } from "../legal";

export const metadata = { title: "Termos de uso e de compra" };
export const dynamic = "force-dynamic";

export default function TermosPage() {
  return <LegalPage kind="terms" />;
}
