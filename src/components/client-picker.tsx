"use client";

import { useId, useMemo, useRef, useState } from "react";

export type ClientOption = { id: string; label: string; is_test: boolean };

const MAX_SHOWN = 50;

/** Sem acento, minúsculo e só letras/números — "Pão" encontra "pao" e "CLI-0001" encontra "cli0001". */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Escolha do cliente por pesquisa: digite parte do nome (razão social ou fantasia) ou do código (CLI-…).
 * O valor enviado no formulário continua sendo o id, num campo oculto com o nome informado.
 */
export function ClientPicker({
  name,
  options,
  value,
  onChange,
  error,
  required,
}: {
  name: string;
  options: ClientOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  required?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const indexed = useMemo(() => options.map((o) => ({ o, key: norm(o.label), compact: norm(o.label).replace(/ /g, "") })), [options]);
  const matches = useMemo(() => {
    const terms = norm(query).split(" ").filter(Boolean);
    if (!terms.length) return indexed.map((i) => i.o);
    return indexed.filter((i) => terms.every((t) => i.key.includes(t) || i.compact.includes(t))).map((i) => i.o);
  }, [indexed, query]);
  const shown = matches.slice(0, MAX_SHOWN);

  const choose = (o: ClientOption) => {
    onChange(o.id);
    setQuery("");
    setOpen(false);
  };
  const labelOf = (o: ClientOption) => `${o.label}${o.is_test ? " [TESTE]" : ""}`;

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-label="Cliente"
        autoComplete="off"
        placeholder="Digite o nome ou o código do cliente"
        value={open ? query : selected ? labelOf(selected) : query}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(ev) => {
          setQuery(ev.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (ev.key === "Enter" && open) {
            // Enter escolhe o cliente destacado em vez de enviar o formulário
            ev.preventDefault();
            if (shown[active]) {
              choose(shown[active]);
              inputRef.current?.blur();
            }
          } else if (ev.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 ${error ? "border-danger" : "border-line"}`}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-line bg-white py-1 text-sm shadow-lg"
        >
          {shown.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(ev) => {
                ev.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-navy/10 text-navy" : "text-ink"} ${o.id === value ? "font-semibold" : ""}`}
            >
              {labelOf(o)}
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2 text-muted">Nenhum cliente encontrado.</li>}
          {matches.length > MAX_SHOWN && (
            <li className="px-3 py-2 text-xs text-muted">
              Mostrando {MAX_SHOWN} de {matches.length}. Digite mais letras para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
