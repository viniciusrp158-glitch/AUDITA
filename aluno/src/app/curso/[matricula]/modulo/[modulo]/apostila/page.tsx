import Link from "next/link";
import { Download } from "lucide-react";
import { minutesLabel, mm, nextAfter, STEP_LABEL } from "@/lib/curso";
import { completeStepAction } from "../../../../actions";
import { PdfViewer } from "../../../../pdf-viewer";
import { StepButton } from "../../../../step-button";
import { loadStep, ModuleHeader, StepPage } from "../shared";

export const metadata = { title: "Apostila" };

export default async function ApostilaPage({ params }: { params: Promise<{ matricula: string; modulo: string }> }) {
  const { c, m } = await loadStep(params, "apostila");
  const done = m.done_steps.includes("apostila");
  const next = m.required_steps[m.required_steps.indexOf("apostila") + 1];
  const nextLabel = next ? `Concluí a leitura · ${STEP_LABEL[next]}` : "Concluí a leitura";
  const file = m.apostila_file_id;
  return (
    <StepPage>
      <ModuleHeader m={m} />
      {file ? (
        <PdfViewer
          src={`/treinamentos/arquivo/${file}`}
          downloadHref={`/treinamentos/arquivo/${file}?baixar=1`}
          title={`Apostila do Módulo ${mm(m.position)}`}
          meta={minutesLabel(m.reading_minutes) ? `leitura de ${minutesLabel(m.reading_minutes)}` : undefined}
        />
      ) : (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">A apostila deste módulo ainda não está disponível. Avise a AUDITA.</p>
      )}
      {m.is_orientation && c.fichaFileId && (
        <a href={`/treinamentos/arquivo/${c.fichaFileId}?baixar=1`} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-navy hover:underline">
          <Download size={15} aria-hidden /> Ficha técnica do curso (PDF)
        </a>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">
          {done ? "Leitura concluída. A apostila continua aqui para consulta." : next === "video" ? "Leia a apostila e depois assista à videoaula." : "Leia a apostila e depois faça a avaliação."}
        </p>
        {done ? (
          <Link href={nextAfter(c, m, "apostila")} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-navy px-5 text-[15px] font-bold text-white hover:bg-navy-700">
            {next ? `Ir para: ${STEP_LABEL[next]}` : "Continuar"}
          </Link>
        ) : (
          c.canStudy && (
            <StepButton action={completeStepAction.bind(null, c.enrollmentId, m.module_id, "apostila")} testId="finish-reading">
              {nextLabel}
            </StepButton>
          )
        )}
      </div>
    </StepPage>
  );
}
