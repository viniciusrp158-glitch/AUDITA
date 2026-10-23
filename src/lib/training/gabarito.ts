/**
 * Leitura do "Gabarito comentado" de um módulo (padrão do pacote L01) a partir do texto extraído do PDF (pdftotext).
 * Cada item começa pelo código e pelo tipo:
 *   "M03-Q01 • Resposta: C"  → objetiva: enunciado, alternativas A) … D) e "Retorno ao aluno: …"
 *   "M03-A01 • Aplicação (sem nota)" → aberta (códigos A, C e R): enunciado e "Resposta esperada: …"
 * A "Chave rápida" do início do gabarito é conferida contra as respostas de cada questão.
 */
export type ParsedOption = { key: string; text: string };
export type ParsedQuestion = {
  code: string;
  kind: "objetiva" | "aberta";
  statement: string;
  options: ParsedOption[] | null;
  correct_key: string | null;
  feedback: string | null;
};
/** passScore: nota mínima declarada no gabarito ("aprovação com no mínimo 7/10"), se houver. */
export type GabaritoResult = { questions: ParsedQuestion[]; warnings: string[]; passScore: number | null };

const HEADER = /^L\d{2,3}\s*•\s*(Uso exclusivo da equipe|Material do aluno)\b.*$/;
const FOOTER = /^AUDITA \| SSMA & SGI\b.*$/;
const ITEM = /\b(M(\d{2})-([QACR])\d{2})\s*•\s*(?:Resposta:\s*([A-E])\b|(?:Aplicação|Caso|Reflexão|Atividade)[^()]{0,40}\(sem nota\))/g;
const KEYS = ["A", "B", "C", "D", "E"];

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
/** Orientações ao corretor dentro da "Resposta esperada" (o aluno vê só a resposta de referência). */
const GRADER_NOTE = /(?:^|\s)(?:Aceitar|Não exigir|Não aceitar)\s[^.]*\./g;

/** Posições das alternativas "A) … B) …" em sequência (a primeira precisa ser A). */
function optionMarks(body: string): number[] {
  const marks: number[] = [];
  let from = 0;
  for (const k of KEYS) {
    const re = new RegExp(`(?:^|\\s)${k}\\)\\s`, "g");
    re.lastIndex = from;
    const m = re.exec(body);
    if (!m) break;
    marks.push(m.index + (m[0].startsWith(k) ? 0 : 1));
    from = m.index + m[0].length;
  }
  return marks;
}

export function parseGabarito(raw: string, expectedModule?: number): GabaritoResult {
  const warnings: string[] = [];
  const text = clean(
    raw
      .replace(/\f/g, "\n")
      .split(/\r?\n/)
      .filter((l) => !HEADER.test(l.trim()) && !FOOTER.test(l.trim()))
      .join(" "),
  );

  const quick = new Map<string, string>();
  const qk = /Chave rápida:(.*?)(?=\bM\d{2}-[QACR]\d{2}\s*•|$)/.exec(text);
  if (qk) for (const m of qk[1].matchAll(/(M\d{2}-Q\d{2}):\s*([A-E])\b/g)) quick.set(m[1], m[2]);

  const heads = [...text.matchAll(ITEM)];
  const questions: ParsedQuestion[] = [];
  heads.forEach((h, i) => {
    const code = h[1];
    const body = clean(text.slice(h.index! + h[0].length, i + 1 < heads.length ? heads[i + 1].index : text.length));
    if (questions.some((q) => q.code === code)) warnings.push(`${code}: código repetido no gabarito.`);
    if (expectedModule && Number(h[2]) !== expectedModule) warnings.push(`${code}: o código não é deste módulo (M${String(expectedModule).padStart(2, "0")}).`);
    if (h[4]) {
      const [main, ...rest] = body.split(/Retorno ao aluno:/);
      const marks = optionMarks(main);
      const options = marks.map((p, j) => ({ key: KEYS[j], text: clean(main.slice(p + 2, marks[j + 1] ?? main.length)) }));
      const statement = clean(marks.length ? main.slice(0, marks[0]) : main);
      const feedback = rest.length ? clean(rest.join(" ")) : null;
      if (options.length < 2) warnings.push(`${code}: alternativas não encontradas.`);
      if (!options.some((o) => o.key === h[4])) warnings.push(`${code}: a resposta ${h[4]} não está entre as alternativas.`);
      if (!feedback) warnings.push(`${code}: sem "Retorno ao aluno".`);
      if (quick.size && quick.get(code) !== h[4])
        warnings.push(`${code}: a chave rápida indica ${quick.get(code) ?? "nada"}, mas a questão indica ${h[4]}.`);
      questions.push({ code, kind: "objetiva", statement, options, correct_key: h[4], feedback });
    } else {
      const [main, ...rest] = body.split(/Resposta esperada:/);
      const feedback = rest.length ? clean(rest.join(" ").replace(GRADER_NOTE, " ")) || null : null;
      if (!feedback) warnings.push(`${code}: sem "Resposta esperada".`);
      questions.push({ code, kind: "aberta", statement: clean(main), options: null, correct_key: null, feedback });
    }
  });
  for (const k of quick.keys()) if (!questions.some((q) => q.code === k)) warnings.push(`${k}: está na chave rápida, mas a questão não foi encontrada.`);
  if (!questions.length) warnings.push("Nenhuma questão encontrada. Confira se o arquivo é o gabarito comentado do módulo.");
  for (const q of questions) if (q.statement.length < 5) warnings.push(`${q.code}: enunciado não encontrado.`);
  const pass = /aprovação com no mínimo (\d{1,3})\s*\/\s*\d{1,3}/i.exec(text);
  return { questions, warnings, passScore: pass ? Number(pass[1]) : null };
}
