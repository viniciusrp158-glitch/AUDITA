"use client";

import { Download, FileText, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number }; transform?: number[] }) => { promise: Promise<void> };
};

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

/**
 * Apostila dentro da página (PDF desenhado página a página; funciona no celular, onde o navegador não mostra PDF
 * embutido). Se o leitor não carregar, fica o botão para abrir o arquivo.
 */
export function PdfViewer({ src, downloadHref, title, meta }: { src: string; downloadHref: string; title: string; meta?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [zi, setZi] = useState(1);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        loaded = (await pdfjs.getDocument({ url: src }).promise) as unknown as PdfDoc;
        if (cancelled) return void loaded.destroy();
        setDoc(loaded);
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !width || !box.current) return;
    let cancelled = false;
    const host = box.current;
    (async () => {
      try {
        // 100% = página na largura toda da área (só a margem do papel); o zoom aumenta ou diminui a partir daí
        const target = Math.max(240, width - 24) * ZOOMS[zi];
        // Nitidez de tela retina sem estourar a memória: no máximo ~1800 px de largura por página
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 1800 / target));
        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: target / base.width });
          const c = document.createElement("canvas");
          c.width = Math.floor(vp.width * dpr);
          c.height = Math.floor(vp.height * dpr);
          c.style.width = `${Math.floor(vp.width)}px`;
          c.style.height = `${Math.floor(vp.height)}px`;
          c.className = "block shrink-0 bg-white shadow-[0_2px_10px_rgba(3,27,53,0.12)]";
          c.setAttribute("role", "img");
          c.setAttribute("aria-label", `Página ${n} de ${doc.numPages} — ${title}`);
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
          if (cancelled) return;
          canvases.push(c);
          if (n === 1) {
            host.replaceChildren(c);
            setState("ok");
          } else host.appendChild(c);
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, width, zi, title]);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white" data-testid="pdf-viewer">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <FileText size={18} className="shrink-0 text-navy" aria-hidden />
        <p className="min-w-0 flex-1 basis-40 text-sm font-semibold text-ink">
          {title}
          {(doc || meta) && (
            <span className="font-normal text-muted">
              {doc ? ` · ${doc.numPages} ${doc.numPages === 1 ? "página" : "páginas"}` : ""}
              {meta ? ` · ${meta}` : ""}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZi((z) => Math.max(0, z - 1))}
            disabled={zi === 0}
            aria-label="Diminuir zoom"
            className="flex size-9 items-center justify-center rounded-lg border border-line hover:bg-surface disabled:opacity-40"
          >
            <Minus size={15} aria-hidden />
          </button>
          <span className="w-12 text-center text-[13px] text-muted tabular-nums">{Math.round(ZOOMS[zi] * 100)}%</span>
          <button
            type="button"
            onClick={() => setZi((z) => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zi === ZOOMS.length - 1}
            aria-label="Aumentar zoom"
            className="flex size-9 items-center justify-center rounded-lg border border-line hover:bg-surface disabled:opacity-40"
          >
            <Plus size={15} aria-hidden />
          </button>
          <a href={downloadHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink hover:bg-surface">
            <Download size={15} aria-hidden /> Baixar PDF
          </a>
        </div>
      </div>
      <div ref={scroller} className="relative h-[calc(100dvh-15rem)] min-h-[420px] overflow-auto bg-paper">
        <div ref={box} className="flex w-max min-w-full flex-col items-center gap-3 px-3 py-3" />
        {state !== "ok" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
            {state === "loading" ? (
              <span>Abrindo a apostila…</span>
            ) : (
              <>
                <span>Não foi possível mostrar a apostila aqui.</span>
                <a href={downloadHref} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2.5 font-semibold text-white">
                  <Download size={15} aria-hidden /> Abrir o PDF
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
