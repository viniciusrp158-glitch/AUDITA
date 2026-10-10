"use client";

import { Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { setThemeAction } from "@/app/(app)/conta/actions";

/** Chave de tema (canto inferior esquerdo). Troca na hora e guarda a escolha na conta do usuário. */
export function ThemeToggle({ initial }: { initial: "claro" | "escuro" }) {
  const [theme, setTheme] = useState(initial);
  const [, start] = useTransition();
  const dark = theme === "escuro";

  function toggle() {
    const next = dark ? "claro" : "escuro";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    start(() => {
      void setThemeAction(next);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
      <span className={`flex items-center gap-1.5 text-xs ${dark ? "text-muted" : "font-semibold text-ink"}`}>
        <Sun size={15} aria-hidden /> Tema claro
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Tema escuro"
        data-testid="theme-toggle"
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full border border-line transition ${dark ? "bg-navy" : "bg-surface"}`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full shadow transition-all ${
            dark ? "left-[22px] bg-white" : "left-0.5 bg-navy"
          }`}
        />
      </button>
      <span className={`flex items-center gap-1.5 text-xs ${dark ? "font-semibold text-ink" : "text-muted"}`}>
        Tema escuro <Moon size={15} aria-hidden />
      </span>
    </div>
  );
}
