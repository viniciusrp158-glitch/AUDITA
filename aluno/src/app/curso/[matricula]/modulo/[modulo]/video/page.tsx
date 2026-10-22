import Link from "next/link";
import { nextAfter, STEP_LABEL } from "@/lib/curso";
import { completeStepAction } from "../../../../actions";
import { VideoPlayer } from "../../../../video-player";
import { loadStep, ModuleHeader, StepPage } from "../shared";

export const metadata = { title: "Videoaula" };

export default async function VideoPage({ params }: { params: Promise<{ matricula: string; modulo: string }> }) {
  const { c, m } = await loadStep(params, "video");
  const done = m.done_steps.includes("video");
  const next = m.required_steps[m.required_steps.indexOf("video") + 1];
  return (
    <StepPage>
      <ModuleHeader m={m} />
      <VideoPlayer
        url={m.video_url!}
        title={`Videoaula · ${m.title}`}
        alreadyDone={done}
        action={!done && c.canStudy ? completeStepAction.bind(null, c.enrollmentId, m.module_id, "video") : null}
        nextLabel={next ? `Concluí a videoaula · ${STEP_LABEL[next]}` : "Concluí a videoaula"}
      />
      {done && (
        <Link href={nextAfter(c, m, "video")} className="inline-flex min-h-12 items-center justify-center self-end rounded-[10px] bg-navy px-5 text-[15px] font-bold text-white hover:bg-navy-700">
          {next ? `Ir para: ${STEP_LABEL[next]}` : "Continuar"}
        </Link>
      )}
    </StepPage>
  );
}
