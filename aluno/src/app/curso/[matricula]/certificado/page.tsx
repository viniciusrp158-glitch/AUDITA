import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { maskCpf } from "@/lib/cpf";
import { fmtDate, loadCourse, minutesLabel } from "@/lib/curso";
import { createClient } from "@/lib/supabase/server";
import { CertificateFit } from "./certificate-fit";
import { CertificatePage, ProgramPage, type CertificateView } from "./certificate-doc";
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

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
/** Titular da assinatura digitalizada usada no certificado (aprovada pelo Diretor em 17/11/2026). */
const SIGNATURE_OWNER = "vinicius rocha pereira";

const publicBase = () => (process.env.ALUNO_PUBLIC_URL ?? "https://audita.seg.br/treinamentos").replace(/\/$/, "");

export default async function CertificadoPage({ params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const c = await loadCourse(matricula);
  if (!c?.certificateCode) notFound();
  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([
    supabase
      .from("training_certificates")
      .select("code, student_name, course_code, course_title, version_label, workload_minutes, instructor_name, started_on, completed_on, final_score, final_max_score, issued_at")
      .eq("enrollment_id", c.enrollmentId)
      .eq("status", "valido")
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const cert = data as Cert | null;
  if (!cert) notFound();
  const { data: student } = auth.user
    ? await supabase.from("training_students").select("cpf").eq("user_id", auth.user.id).maybeSingle()
    : { data: null };

  const verifyUrl = `${publicBase()}/certificado/${cert.code}`;
  const qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#031b35", light: "#ffffff" } });
  const final = c.modules.find((m) => m.pass_score);

  const v: CertificateView = {
    studentName: cert.student_name,
    cpfMasked: maskCpf((student as { cpf: string | null } | null)?.cpf),
    courseTitle: cert.course_title,
    modalityLine: `Curso livre${c.modality ? ` · ${c.modality}` : ""}`,
    versionText: `${cert.course_code} v${cert.version_label}`,
    workloadText: cert.workload_minutes ? hoursText(cert.workload_minutes) : null,
    startedOn: fmtDate(cert.started_on),
    completedOn: fmtDate(cert.completed_on),
    modulesTotal: c.total,
    score: cert.final_score,
    maxScore: cert.final_max_score,
    minScore: final?.pass_score ?? null,
    instructorName: cert.instructor_name,
    showSignature: !!cert.instructor_name && norm(cert.instructor_name) === SIGNATURE_OWNER,
    code: cert.code,
    verifyText: verifyUrl.replace(/^https?:\/\//, "").replace(/\/[^/]+$/, ""),
    qrSvg,
    issuedOn: new Date(cert.issued_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    notice: c.notice,
    modules: c.modules.map((m) => ({ position: m.position, title: m.title, completed: m.completed })),
  };

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-6 sm:px-8 print:max-w-none print:gap-0 print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-navy">Seu certificado</h1>
          <p className="text-sm text-muted">Para guardar em PDF, use “Imprimir” e escolha “Salvar como PDF”. São duas páginas: o certificado e o conteúdo programático.</p>
        </div>
        <PrintButton />
      </div>

      <CertificateFit className="shadow-[0_2px_16px_rgba(3,27,53,0.10)] print:break-after-page print:shadow-none">
        <CertificatePage v={v} />
      </CertificateFit>
      <CertificateFit className="shadow-[0_2px_16px_rgba(3,27,53,0.10)] print:shadow-none">
        <ProgramPage v={v} />
      </CertificateFit>
    </div>
  );
}
