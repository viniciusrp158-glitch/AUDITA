import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Artigos do site (plano aprovado pelo Diretor em 24/11/2026: https://claude.ai/artifact/BwcnnVDE24x7VvqEHNWP1u).
 * Cada artigo é um arquivo site/content/artigos/<endereco>.md com um cabeçalho entre linhas "---":
 *
 *   titulo, descricao, categoria (SST | Meio Ambiente | SGI), termo (busca principal), publicado e revisado (AAAA-MM-DD),
 *   situacao (rascunho | publicado), servico e servicoRotulo (página do convite final), convite (mensagem do WhatsApp).
 *
 * Só entra no site o que tem situacao "publicado" e data de publicação até hoje. Rascunhos aparecem apenas na prévia
 * local, com ARTIGOS_RASCUNHOS=1 no build (nunca no build da VPS).
 */
export type Artigo = {
  slug: string;
  titulo: string;
  descricao: string;
  categoria: string;
  termo: string;
  publicado: string;
  revisado: string;
  situacao: "rascunho" | "publicado";
  servico: string;
  servicoRotulo: string;
  convite: string;
  corpo: string;
  palavras: number;
};

// O build roda da raiz do repositório (`npx next build site`) ou de dentro de site/: vale a pasta que existir
const PASTA = [join(process.cwd(), "site", "content", "artigos"), join(process.cwd(), "content", "artigos")].find((p) => existsSync(p)) ?? join(process.cwd(), "site", "content", "artigos");
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function ler(arquivo: string): Artigo {
  const texto = readFileSync(join(PASTA, arquivo), "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(texto);
  if (!m) throw new Error(`Artigo sem cabeçalho: ${arquivo}`);
  const meta: Record<string, string> = {};
  for (const linha of m[1].split("\n")) {
    const i = linha.indexOf(":");
    if (i > 0) meta[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  const faltando = ["titulo", "descricao", "categoria", "termo", "publicado", "revisado", "situacao", "servico", "servicoRotulo", "convite"].filter((k) => !meta[k]);
  if (faltando.length) throw new Error(`Artigo ${arquivo} sem: ${faltando.join(", ")}`);
  if (!DATA.test(meta.publicado) || !DATA.test(meta.revisado)) throw new Error(`Artigo ${arquivo}: datas no formato AAAA-MM-DD`);
  if (meta.situacao !== "rascunho" && meta.situacao !== "publicado") throw new Error(`Artigo ${arquivo}: situacao rascunho ou publicado`);
  const corpo = m[2].trim();
  return {
    slug: arquivo.replace(/\.md$/, ""),
    titulo: meta.titulo,
    descricao: meta.descricao,
    categoria: meta.categoria,
    termo: meta.termo,
    publicado: meta.publicado,
    revisado: meta.revisado,
    situacao: meta.situacao,
    servico: meta.servico,
    servicoRotulo: meta.servicoRotulo,
    convite: meta.convite,
    corpo,
    palavras: corpo.split(/\s+/).filter(Boolean).length,
  };
}

/** Artigos que vão ao ar, do mais novo para o mais antigo. */
export function listarArtigos(): Artigo[] {
  if (!existsSync(PASTA)) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const rascunhos = process.env.ARTIGOS_RASCUNHOS === "1";
  return readdirSync(PASTA)
    .filter((a) => a.endsWith(".md") && !a.startsWith("_"))
    .map(ler)
    .filter((a) => rascunhos || (a.situacao === "publicado" && a.publicado <= hoje))
    .sort((a, b) => (a.publicado < b.publicado ? 1 : a.publicado > b.publicado ? -1 : a.slug.localeCompare(b.slug)));
}

export function obterArtigo(slug: string): Artigo | undefined {
  return listarArtigos().find((a) => a.slug === slug);
}

export function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Tempo de leitura em minutos (200 palavras por minuto). */
export function minutos(a: Artigo) {
  return Math.max(1, Math.round(a.palavras / 200));
}
