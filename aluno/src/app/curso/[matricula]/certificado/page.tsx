import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { fmtDate, loadCourse, minutesLabel } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "../../../shell";
import { CertificateFit } from "./certificate-fit";
import { PrintButton } from "./print-button";

export const metadata = { title: "Certificado" };

type Cert = {
  code: string;
  student_name: string;
  course_code: string;
  course_title: string;
  version_label: string;
  workload_minutes: number | null;
  instructor_name: string | null;
  started_on: string;
  completed_on: string;
  final_score: number | null;
  final_max_score: number | null;
  issued_at: string;
};

function hoursText(min: number): string {
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h} ${h === 1 ? "hora" : "horas"}` : (minutesLabel(min) ?? "");
}

const publicBase = () => (process.env.ALUNO_PUBLIC_URL ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");

export default async function CertificadoPage({ params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const c = await loadCourse(matricula);
  if (!c?.certificateCode) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_certificates")
    .select("code, student_name, course_code, course_title, version_label, workload_minutes, instructor_name, started_on, completed_on, final_score, final_max_score, issued_at")
    .eq("enrollment_id", c.enrollmentId)
    .eq("status", "valido")
    .maybeSingle();
  const cert = data as Cert | null;
  if (!cert) notFound();
  const verifyUrl = `${publicBase()}/certificado/${cert.code}`;
  const qr = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#031b35", light: "#ffffff" } });
  const final = c.modules.find((m) => m.pass_score);
  const issued = new Date(cert.issued_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-6 sm:px-8 print:max-w-none print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-navy">Seu certificado</h1>
          <p className="text-sm text-muted">Para guardar em PDF, use “Imprimir” e escolha “Salvar como PDF”.</p>
        </div>
        <PrintButton />
      </div>

      <CertificateFit>
        <article
          className="box-border flex h-[794px] w-[1123px] max-w-none bg-white p-7 text-ink shadow-[0_2px_16px_rgba(3,27,53,0.10)] print:h-[210mm] print:w-[297mm] print:shadow-none"
          data-testid="certificate"
        >
          <div className="flex size-full overflow-hidden rounded-md border-2 border-navy">
            <div className="w-6 shrink-0 bg-green" aria-hidden />
            <div className="flex flex-1 flex-col gap-5 px-16 pt-12 pb-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Logo width={150} />
                  <div className="border-l border-line pl-3">
                    <p className="text-base font-extrabold tracking-[0.05em] text-navy">SSMA &amp; SGI</p>
                    <p className="text-xs text-muted">Gestão inteligente para ambientes mais seguros</p>
                  </div>
                </div>
                <p className="text-right text-xs leading-relaxed text-muted">
                  Curso livre{c.modality ? ` · ${c.modality}` : ""}
                  <br />
                  Versão do curso: {cert.course_code} v{cert.version_label}
                </p>
              </div>

              <div className="mt-6">
                <p className="text-[13px] font-bold tracking-[0.18em] text-green-dark">CERTIFICADO DE CONCLUSÃO</p>
                <p className="mt-4 text-base text-ink/80">Certificamos que</p>
                <p className="mt-1.5 border-b-2 border-line pb-2.5 text-[40px] leading-tight font-extrabold text-navy" data-testid="certificate-name">
                  {cert.student_name}
                </p>
                <p className="mt-4 max-w-[860px] text-[17px] leading-relaxed text-ink/80">
                  concluiu o curso livre <strong className="text-navy">{cert.course_title}</strong>
                  {cert.workload_minutes ? (
                    <>
                      , com carga horária de <strong className="text-navy">{hoursText(cert.workload_minutes)}</strong>
                    </>
                  ) : null}
                  , no período de {fmtDate(cert.started_on)} a {fmtDate(cert.completed_on)}, cumprindo as atividades obrigatórias dos {c.total} módulos
                  {cert.final_score != null && cert.final_max_score
                    ? ` e obtendo ${cert.final_score}/${cert.final_max_score} na avaliação final${final?.pass_score ? ` (mínimo para aprovação: ${final.pass_score}/${cert.final_max_score})` : ""}`
                    : ""}
                  .
                </p>
              </div>

              <div className="flex-1" />

              <div className="flex items-end gap-10">
                <div className="flex-1">
                  {cert.instructor_name && (
                    <>
                      <p className="w-72 border-t border-navy pt-2 text-sm font-bold text-navy">{cert.instructor_name}</p>
                      <p className="text-xs text-muted">Instrutor · AUDITA | SSMA &amp; SGI</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3.5">
                  <span className="block size-[92px] shrink-0" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code de verificação" role="img" />
                  <div className="text-xs leading-relaxed text-ink/80">
                    <p className="font-bold text-navy" data-testid="certificate-code">
                      Código: {cert.code}
                    </p>
                    <p>Verifique em {verifyUrl.replace(/^https?:\/\//, "").replace(/\/[^/]+$/, "")}</p>
                    <p>Emitido em {issued}</p>
                  </div>
                </div>
              </div>
              {c.notice && <p className="border-t border-line pt-2.5 text-[11px] leading-normal text-muted">{c.notice}</p>}
            </div>
          </div>
        </article>
      </CertificateFit>
    </div>
  );
}
