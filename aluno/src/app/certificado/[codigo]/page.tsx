import { BadgeCheck, CircleX } from "lucide-react";
import { Logo } from "../../shell";

export const metadata = { title: "Verificação de certificado" };
export const dynamic = "force-dynamic";

type Verify = {
  encontrado: boolean;
  codigo?: string;
  situacao?: "valido" | "cancelado";
  aluno?: string;
  curso?: string;
  codigo_curso?: string;
  carga_minutos?: number | null;
  inicio?: string;
  conclusao?: string;
};

function fmtDate(d?: string) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function hours(min?: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} ${h === 1 ? "hora" : "horas"}`;
}

/** Consulta pela função "certificado" (a chave de serviço fica só nela; nada é liberado para visitantes no banco). */
async function verify(code: string): Promise<Verify | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/certificado`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      body: JSON.stringify({ codigo: code }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Verify;
  } catch {
    return null;
  }
}

export default async function VerificarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const code = decodeURIComponent(codigo).trim().toUpperCase();
  const r = await verify(code);
  const ok = r?.encontrado && r.situacao === "valido";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo width={150} />
          <span className="text-xs text-muted">AUDITA | SSMA &amp; SGI · Verificação de certificado</span>
        </div>
        <section className="rounded-xl border border-line bg-white p-6 shadow-sm" data-testid="verify-result">
          {r === null ? (
            <p className="text-sm text-muted">Não foi possível consultar agora. Tente de novo em alguns minutos.</p>
          ) : r.encontrado ? (
            <div className="flex flex-col gap-4">
              <p className={`flex items-center gap-2 text-lg font-bold ${ok ? "text-ok" : "text-danger"}`}>
                {ok ? <BadgeCheck size={22} aria-hidden /> : <CircleX size={22} aria-hidden />}
                {ok ? "Certificado válido" : "Certificado cancelado"}
              </p>
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-muted">Aluno</dt>
                <dd className="font-semibold text-ink">{r.aluno}</dd>
                <dt className="text-muted">Curso livre</dt>
                <dd className="text-ink">
                  {r.curso} ({r.codigo_curso})
                </dd>
                {hours(r.carga_minutos) && (
                  <>
                    <dt className="text-muted">Carga horária</dt>
                    <dd className="text-ink">{hours(r.carga_minutos)}</dd>
                  </>
                )}
                <dt className="text-muted">Período</dt>
                <dd className="text-ink">
                  {fmtDate(r.inicio)} a {fmtDate(r.conclusao)}
                </dd>
                <dt className="text-muted">Código</dt>
                <dd className="font-mono text-ink">{r.codigo}</dd>
              </dl>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-lg font-bold text-danger">
                <CircleX size={22} aria-hidden /> Certificado não encontrado
              </p>
              <p className="text-sm text-muted">Confira o código impresso no certificado (formato XXXX-XXXX-XXXX).</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
