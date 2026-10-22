/**
 * Leitura do gabarito comentado (texto do pdftotext): objetivas com alternativas, resposta e retorno; abertas com a
 * resposta de referência (sem as orientações ao corretor); cabeçalho e rodapé de página ignorados; conferência da chave
 * rápida. Texto fictício no mesmo formato do pacote L01.
 */
import { describe, expect, it } from "vitest";
import { parseGabarito } from "@/lib/training/gabarito";

const TEXTO = `L01 • Uso exclusivo da equipe v1.2 • 22/10/2026
Gabarito comentado • Módulo 03 • [TESTE] Módulo fictício
Não disponibilizar ao aluno. Chave rápida: M03-Q01: C • M03-Q02: B. As atividades deste módulo não compõem nota.
M03-Q01 • Resposta: C Qual alternativa representa a consequência possível? A) A instabilidade da pilha. B) A circulação
de pessoas. C) Uma lesão por impacto. D) A frequência de reposição.
Retorno ao aluno: Consequência é o dano possível.
AUDITA | SSMA & SGI • Gestão inteligente para ambientes mais seguros. • Elaboração: [TESTE]
\fL01 • Uso exclusivo da equipe v1.2 • 22/10/2026
M03-Q02 • Resposta: B Qual alternativa descreve o risco? A) A existência de um objeto. B) A relação entre probabilidade
e gravidade. C) Uma atividade sem acidente.
Retorno ao aluno: O risco depende do contexto.
M03-A01 • Aplicação (sem nota) Associe: 1) ruído; 2) vapor. Tipos: agente físico e químico.
Resposta esperada: 1 ruído: físico; 2 vapor: químico. Aceitar respostas equivalentes coerentes. Não exigir termos técnicos.
AUDITA | SSMA & SGI • Gestão inteligente para ambientes mais seguros. • Elaboração: [TESTE]`;

describe("parseGabarito", () => {
  it("lê objetivas e abertas, sem cabeçalho/rodapé e sem orientações ao corretor", () => {
    const r = parseGabarito(TEXTO, 3);
    expect(r.warnings).toEqual([]);
    expect(r.questions.map((q) => q.code)).toEqual(["M03-Q01", "M03-Q02", "M03-A01"]);
    const [q1, q2, a1] = r.questions;
    expect(q1).toMatchObject({ kind: "objetiva", correct_key: "C", statement: "Qual alternativa representa a consequência possível?" });
    expect(q1.options).toEqual([
      { key: "A", text: "A instabilidade da pilha." },
      { key: "B", text: "A circulação de pessoas." },
      { key: "C", text: "Uma lesão por impacto." },
      { key: "D", text: "A frequência de reposição." },
    ]);
    expect(q1.feedback).toBe("Consequência é o dano possível.");
    expect(q2.options).toHaveLength(3);
    expect(q2.options![2].text).toBe("Uma atividade sem acidente.");
    expect(q2.feedback).toBe("O risco depende do contexto.");
    expect(a1).toMatchObject({ kind: "aberta", options: null, correct_key: null, statement: "Associe: 1) ruído; 2) vapor. Tipos: agente físico e químico." });
    expect(a1.feedback).toBe("1 ruído: físico; 2 vapor: químico.");
  });

  it("avisa divergência com a chave rápida, módulo errado e arquivo sem questões", () => {
    const r = parseGabarito(TEXTO.replace("M03-Q02: B", "M03-Q02: D"), 4);
    expect(r.warnings).toContain("M03-Q02: a chave rápida indica D, mas a questão indica B.");
    expect(r.warnings.some((w) => w.includes("não é deste módulo (M04)"))).toBe(true);
    expect(parseGabarito("Apostila do módulo, sem questões.").warnings[0]).toContain("Nenhuma questão encontrada");
  });
});
