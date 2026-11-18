"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rascunho automático dos formulários longos (Frente A, A9): guarda o que foi digitado NESTE aparelho (navegador) e,
 * se a página for fechada ou cair antes de salvar, oferece recuperar. Apagado ao enviar o formulário; vale 7 dias.
 * Não vai para o servidor. Campos ocultos, senhas e arquivos não são guardados.
 */
const TTL = 7 * 86_400_000;
type Draft = { at: number; values: Record<string, string> };

function read(key: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
    if (!d || Date.now() - d.at > TTL || !Object.values(d.values).some((v) => v && v !== "off")) return null;
    return d;
  } catch {
    return null;
  }
}

function fields(form: HTMLFormElement, exclude: string[]) {
  return [...form.elements].filter(
    (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) &&
      !!el.name &&
      !exclude.includes(el.name) &&
      !(el instanceof HTMLInputElement && ["hidden", "password", "file", "submit", "button"].includes(el.type)),
  );
}

/** Define o valor como se a pessoa tivesse digitado (o React percebe a mudança). */
function setNative(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    const on = el.type === "checkbox" ? value === "on" : el.value === value;
    if (el.checked !== on) el.click();
    return;
  }
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

export function FormDraft({ formRef, storageKey, exclude = [] }: { formRef: React.RefObject<HTMLFormElement | null>; storageKey: string; exclude?: string[] }) {
  const key = `audita:rascunho:${storageKey}`;
  const [pending, setPending] = useState<Draft | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const decided = useRef(false);
  const ex = useRef(exclude);
  ex.current = exclude;

  useEffect(() => {
    const d = read(key);
    if (d) setPending(d);
    else decided.current = true;
  }, [key]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!decided.current) return; // há um rascunho anterior esperando a decisão: não sobrescreve
        const values: Record<string, string> = {};
        for (const el of fields(form, ex.current)) {
          if (el instanceof HTMLInputElement && el.type === "checkbox") values[el.name] = el.checked ? "on" : "off";
          else if (el instanceof HTMLInputElement && el.type === "radio") {
            if (el.checked) values[el.name] = el.value;
          } else values[el.name] = el.value;
        }
        try {
          localStorage.setItem(key, JSON.stringify({ at: Date.now(), values }));
          setSavedAt(Date.now());
        } catch {
          /* armazenamento indisponível (navegação privada): segue sem rascunho */
        }
      }, 800);
    };
    const clear = () => {
      clearTimeout(timer);
      try {
        localStorage.removeItem(key);
      } catch {}
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    form.addEventListener("submit", clear);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
      form.removeEventListener("submit", clear);
    };
  }, [formRef, key]);

  const restore = () => {
    const form = formRef.current;
    if (!form || !pending) return;
    // Primeiro os seletores (podem mostrar ou esconder campos), depois o resto
    const els = fields(form, exclude);
    for (const el of els.filter((e) => e instanceof HTMLSelectElement)) if (el.name in pending.values) setNative(el, pending.values[el.name]);
    setTimeout(() => {
      for (const el of fields(form, exclude)) if (!(el instanceof HTMLSelectElement) && el.name in pending.values) setNative(el, pending.values[el.name]);
      decided.current = true;
      setPending(null);
    }, 50);
  };
  const discard = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
    decided.current = true;
    setPending(null);
  };

  const time = (t: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(t).replace(",", "");

  if (pending)
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink">
        <span>Há um rascunho não enviado deste formulário, salvo neste aparelho em {time(pending.at)}.</span>
        <span className="flex gap-2">
          <button type="button" onClick={restore} className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white">
            Recuperar rascunho
          </button>
          <button type="button" onClick={discard} className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink">
            Descartar
          </button>
        </span>
      </div>
    );
  return savedAt ? <p className="text-xs text-muted" aria-live="polite">Rascunho guardado neste aparelho às {time(savedAt).slice(-5)}.</p> : null;
}

/**
 * Validação mais clara (A9): quando o servidor devolve erros, rola até o primeiro campo com problema e põe o cursor
 * nele (em formulários longos o aviso ficava no topo e o campo, lá embaixo).
 */
export function useFocusFirstError(formRef: React.RefObject<HTMLFormElement | null>, state: unknown) {
  useEffect(() => {
    const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, [formRef, state]);
}
