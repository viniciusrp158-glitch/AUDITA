"use client";

import { useEffect, useRef, useState } from "react";
import type { StepState } from "./actions";
import { StepButton } from "./step-button";

type YTPlayer = { getCurrentTime: () => number; getDuration: () => number; destroy: () => void };
type YTNamespace = {
  Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** ID do vídeo a partir do link guardado no módulo (watch?v=, youtu.be/, embed/, live/). */
export function youtubeId(url: string): string | null {
  return /(?:v=|youtu\.be\/|embed\/|live\/)([A-Za-z0-9_-]{11})/.exec(url)?.[1] ?? null;
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("youtube"));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * Videoaula do YouTube (não listada) incorporada. A conclusão é liberada quando o vídeo chega ao fim (ou a 90%);
 * se o YouTube não carregar o controle do player, o botão fica liberado para não travar o aluno.
 */
export function VideoPlayer({
  url,
  title,
  alreadyDone,
  action,
  nextLabel,
}: {
  url: string;
  title: string;
  alreadyDone: boolean;
  action: (() => Promise<StepState>) | null;
  nextLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [watched, setWatched] = useState(alreadyDone);
  const [apiFailed, setApiFailed] = useState(false);
  const id = youtubeId(url);

  useEffect(() => {
    if (!id || !host.current) return;
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const fallback = setTimeout(() => !player && setApiFailed(true), 10_000);
    loadApi()
      .then((YT) => {
        if (cancelled || !host.current) return;
        player = new YT.Player(host.current, {
          videoId: id,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_lang_pref: "pt", hl: "pt-BR" },
          events: {
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.ENDED) setWatched(true);
            },
          },
        });
        timer = setInterval(() => {
          try {
            const d = player?.getDuration() ?? 0;
            if (d > 0 && (player?.getCurrentTime() ?? 0) / d >= 0.9) setWatched(true);
          } catch {
            /* player ainda carregando */
          }
        }, 3000);
      })
      .catch(() => setApiFailed(true));
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      clearInterval(timer);
      player?.destroy();
    };
  }, [id]);

  const canFinish = watched || apiFailed;
  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="relative aspect-video w-full bg-navy" data-testid="video-player">
          {id ? (
            <div ref={host} className="absolute inset-0 size-full" title={title} />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">O link desta videoaula não é válido. Avise a AUDITA.</p>
          )}
        </div>
        <div className="px-5 py-4">
          <p className="text-base font-bold text-ink">{title}</p>
          <p className="mt-1 text-[13px] text-muted">Use o botão “CC” do player para ativar as legendas.</p>
        </div>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted" aria-live="polite">
          {alreadyDone ? "Videoaula concluída. Você pode assistir de novo quando quiser." : canFinish ? "Pronto: você pode seguir para a avaliação." : "Assista até o fim para liberar a próxima etapa."}
        </p>
        {action && (
          <StepButton action={action} disabled={!canFinish} testId="finish-video">
            {nextLabel}
          </StepButton>
        )}
      </div>
    </>
  );
}
