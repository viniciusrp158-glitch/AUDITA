import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Markdown simples dos artigos, sem bibliotecas novas no package.json compartilhado e sem HTML cru (nada de
 * dangerouslySetInnerHTML). Aceita: ## e ### títulos, parágrafos, listas com "-" e "1.", destaques com ">",
 * tabelas com "|", **negrito**, *itálico* e [links](url). Links internos começam com "/" e usam o Link do Next;
 * externos abrem em nova aba.
 */

function slugTitulo(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function emLinha(texto: string, chave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const k = `${chave}-${i++}`;
    if (m[1]) {
      const href = m[2];
      if (href.startsWith("/")) partes.push(<Link key={k} href={href}>{m[1]}</Link>);
      else if (/^https:\/\//.test(href)) partes.push(<a key={k} href={href} target="_blank" rel="noopener">{m[1]}</a>);
      else partes.push(m[1]);
    } else if (m[3]) partes.push(<strong key={k}>{m[3]}</strong>);
    else if (m[4]) partes.push(<em key={k}>{m[4]}</em>);
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function titulosDoArtigo(md: string) {
  return md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => ({ texto: l.slice(3).trim(), id: slugTitulo(l.slice(3).trim()) }));
}

export function Markdown({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    const k = `b${n++}`;
    if (!l.trim()) {
      i++;
      continue;
    }
    if (l.startsWith("### ")) {
      blocos.push(<h3 key={k}>{emLinha(l.slice(4).trim(), k)}</h3>);
      i++;
    } else if (l.startsWith("## ")) {
      const t = l.slice(3).trim();
      blocos.push(<h2 key={k} id={slugTitulo(t)}>{emLinha(t, k)}</h2>);
      i++;
    } else if (/^\s*- /.test(l)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\s*- /.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*- /, ""));
      blocos.push(<ul key={k}>{itens.map((t, j) => <li key={j}>{emLinha(t, `${k}-${j}`)}</li>)}</ul>);
    } else if (/^\s*\d+\. /.test(l)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\s*\d+\. /.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*\d+\. /, ""));
      blocos.push(<ol key={k}>{itens.map((t, j) => <li key={j}>{emLinha(t, `${k}-${j}`)}</li>)}</ol>);
    } else if (l.startsWith(">")) {
      const partes: string[] = [];
      while (i < linhas.length && linhas[i].startsWith(">")) partes.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push(<aside key={k} className="artigo__destaque">{emLinha(partes.join(" "), k)}</aside>);
    } else if (l.trim().startsWith("|")) {
      const linhasTabela: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        const cels = linhas[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cels.every((c) => /^:?-{3,}:?$/.test(c))) linhasTabela.push(cels);
      }
      const [cab, ...corpo] = linhasTabela;
      blocos.push(
        <div key={k} className="artigo__tabela">
          <table>
            <thead><tr>{cab.map((c, j) => <th key={j} scope="col">{emLinha(c, `${k}-h${j}`)}</th>)}</tr></thead>
            <tbody>{corpo.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{emLinha(c, `${k}-${ri}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else {
      const partes: string[] = [];
      while (i < linhas.length && linhas[i].trim() && !/^(#{2,3} |\s*- |\s*\d+\. |>|\s*\|)/.test(linhas[i])) partes.push(linhas[i++].trim());
      blocos.push(<p key={k}>{emLinha(partes.join(" "), k)}</p>);
    }
  }
  return <>{blocos}</>;
}
