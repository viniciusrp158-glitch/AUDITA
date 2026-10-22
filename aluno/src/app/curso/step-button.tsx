"use client";

import { useState, useTransition } from "react";
import type { StepState } from "./actions";

/** Botão principal de uma etapa (chama a ação do servidor e mostra o motivo, se a ação recusar). */
export function StepButton({
  action,
  children,
  disabled,
  tone = "navy",
  testId,
}: {
  action: () => Promise<StepState>;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "navy" | "green";
  testId?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = tone === "green" ? "bg-green text-navy hover:brightness-95" : "bg-navy text-white hover:bg-navy-700";
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        data-testid={testId}
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await action();
            if (r?.error) setError(r.error);
          })
        }
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] px-5 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
      >
        {pending ? "Aguarde…" : children}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
