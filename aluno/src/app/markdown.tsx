import { Fragment } from "react";

/**
 * Formatação dos textos legais cadastrados na gestão (termos e privacidade), no subconjunto de Markdown que eles usam:
 * títulos (#, ##, ###), negrito (**…**), listas (- …), tabelas (| … |), citações (> …), linha (---) e links http(s).
 * Nada de HTML do texto é interpretado (tudo vira texto do React).
 */
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(p)) {
      const url = p.replace(/[.,;:]+$/, "");
      return (
        <Fragment key={`${key}-${i}`}>
          <a href={url} className="text-navy underline">
            {url}
          </a>
          {p.slice(url.length)}
        </Fragment>
      );
    }
    return <Fragment key={`${key}-${i}`}>{p}</Fragment>;
  });
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    const k = `b${i}`;
    if (!t) {
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      const cls = h[1].length === 1 ? "mt-2 text-2xl font-extrabold text-navy" : h[1].length === 2 ? "mt-6 text-lg font-bold text-navy" : "mt-4 font-bold text-navy";
      const Tag = (h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      out.push(
        <Tag key={k} className={cls}>
          {inline(h[2], k)}
        </Tag>,
      );
      i++;
      continue;
    }
    if (/^-{3,}$/.test(t)) {
      out.push(<hr key={k} className="my-4 border-line" />);
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!/^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(lines[i].trim())) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={k} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="border-b-2 border-line px-3 py-2 font-semibold text-navy">
                    {inline(c, `${k}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-line align-top">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2">
                      {inline(c, `${k}r${ri}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^[-*]\s+/, ""));
      out.push(
        <ul key={k} className="my-2 list-disc space-y-1 pl-6">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${k}l${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (t.startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) q.push(lines[i++].trim().replace(/^>\s?/, ""));
      out.push(
        <blockquote key={k} className="my-3 border-l-4 border-lime-200 bg-lime-50 px-4 py-2">
          {inline(q.join(" "), k)}
        </blockquote>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\||>|-{3,}$)/.test(lines[i].trim())) para.push(lines[i++].trim());
    out.push(
      <p key={k} className="my-2">
        {inline(para.join(" "), k)}
      </p>,
    );
  }
  return <>{out}</>;
}
