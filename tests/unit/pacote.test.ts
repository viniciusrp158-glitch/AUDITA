/**
 * Importador do pacote .zip: classificação dos arquivos pelo padrão do material (L01) e leitura da ficha técnica
 * (texto do pdftotext). Nomes e textos fictícios no mesmo formato do pacote.
 */
import { describe, expect, it } from "vitest";
import { classifyPackage, parseFicha, titleFromFolder } from "@/lib/training/pacote";

const ROOT = "01. Curso fictício (OK)";
const mods = [
  [1, "M01_Ambientacao"],
  [2, "M02_Fundamentos_de_SST"],
  [3, "M03_Perigos_e_Riscos"],
] as const;
const entries = [
  `${ROOT}/00_Orientacoes/T01_LEIA_PRIMEIRO.pdf`,
  `${ROOT}/01_Ficha_e_Plano/T01_Ficha_Tecnica.pdf`,
  `${ROOT}/01_Ficha_e_Plano/T01_Plano_Pedagogico.pdf`,
  `${ROOT}/03_Instrutor/T01_Gabarito_Consolidado.pdf`,
  ...mods.flatMap(([n, d]) => {
    const m = `M0${n}`;
    return [
      `${ROOT}/02_Aluno/${d}/T01_${m}_Apostila.pdf`,
      `${ROOT}/02_Aluno/${d}/T01_${m}_Avaliacao.pdf`,
      `${ROOT}/03_Instrutor/${d}/T01_${m}_Roteiro.pdf`,
      ...(n === 3 ? [] : [`${ROOT}/03_Instrutor/${d}/T01_${m}_Gabarito.pdf`]),
      `${ROOT}/04_Slides/${d}/T01_${m}_Slides.pdf`,
      `${ROOT}/04_Slides/${d}/PNG_4K/T01_${m}_Slide_01.png`,
      `${ROOT}/04_Slides/${d}/PNG_4K/T01_${m}_Slide_02.png`,
    ];
  }),
  `${ROOT}/04_Slides/M02_Fundamentos_de_SST/T01_M02_Slides_copia.pdf`,
  `${ROOT}/__MACOSX/._T01_Ficha_Tecnica.pdf`,
  `${ROOT}/02_Aluno/M01_Ambientacao/rascunho.docx`,
].map((path) => ({ path, size: 1000 }));

describe("classifyPackage", () => {
  const plan = classifyPackage(entries);
  const kindOf = (name: string) => plan.files.find((f) => f.name === name);

  it("coloca cada arquivo no tipo e no módulo certos", () => {
    expect(plan.code).toBe("T01");
    expect(plan.modules).toEqual([1, 2, 3]);
    expect(kindOf("T01_LEIA_PRIMEIRO.pdf")).toMatchObject({ kind: "orientacoes", module: null });
    expect(kindOf("T01_Ficha_Tecnica.pdf")).toMatchObject({ kind: "ficha_tecnica", module: null });
    expect(kindOf("T01_Plano_Pedagogico.pdf")).toMatchObject({ kind: "plano_pedagogico", module: null });
    expect(kindOf("T01_Gabarito_Consolidado.pdf")).toMatchObject({ kind: "gabarito_consolidado", module: null });
    expect(kindOf("T01_M02_Apostila.pdf")).toMatchObject({ kind: "apostila", module: 2 });
    expect(kindOf("T01_M02_Avaliacao.pdf")).toMatchObject({ kind: "avaliacao_pdf", module: 2 });
    expect(kindOf("T01_M02_Roteiro.pdf")).toMatchObject({ kind: "roteiro", module: 2 });
    expect(kindOf("T01_M02_Gabarito.pdf")).toMatchObject({ kind: "gabarito", module: 2 });
    expect(kindOf("T01_M02_Slides.pdf")).toMatchObject({ kind: "slides_pdf", module: 2 });
    expect(plan.files.filter((f) => f.kind === "slide_imagem")).toHaveLength(6);
    // 4 documentos do curso + 3 módulos × (5 ou 4 PDFs) + 6 imagens
    expect(plan.files).toHaveLength(4 + 5 + 5 + 4 + 6);
  });

  it("deixa de fora o que não é do padrão, repetidos e lixo do sistema, e avisa o que falta", () => {
    expect(plan.ignored.map((i) => i.path.split("/").pop())).toEqual(expect.arrayContaining(["rascunho.docx", "T01_M02_Slides_copia.pdf"]));
    expect(plan.ignored.some((i) => i.path.includes("__MACOSX"))).toBe(false);
    expect(plan.files.some((f) => f.path.includes("__MACOSX"))).toBe(false);
    expect(plan.warnings).toContain("M03: sem gabarito comentado (o módulo fica sem questões).");
    const gap = classifyPackage(entries.filter((e) => !e.path.includes("M02")));
    expect(gap.warnings).toContain("Falta o módulo entre M01 e M03.");
  });

  it("título pelo nome da pasta quando não há ficha", () => {
    expect(titleFromFolder(`${ROOT}/02_Aluno/M03_Perigos_e_Riscos/T01_M03_Apostila.pdf`, 3)).toBe("Perigos e Riscos");
  });
});

const FICHA = `T01 • Material do aluno v2.3 • 01/10/2026

Ficha técnica e conteúdo programático
[TESTE] Curso Fictício de Verificação • AUDITA | SSMA & SGI

Campo Curso
Identificação interna Instituição Responsável técnico e instrutor Modalidade Carga horária Público-alvo
Descrição [TESTE] Curso Fictício de Verificação
T01 AUDITA | SSMA & SGI
[TESTE] Instrutor Fictício
100% EAD, assíncrono
2 horas (120 minutos), em 2 módulos
Pessoas fictícias de teste
Nenhum pré-requisito

Objetivo geral
Verificar a leitura da ficha técnica.

Conteúdo programático e carga horária
Módulo 01 • Ambientação
Objetivo: Conhecer a plataforma. Conteúdo: Boas-vindas; como estudar.
Módulo 02 • Tema fictício de teste
Objetivo: Aplicar conceitos fictícios.
Conteúdo: Conceito A; conceito B.
Metodologia
Videoaula e apostila.
Avaliação e certificação
Atividades obrigatórias, sem nota.
Importante: curso introdutório fictício.
Recursos e apoio
Internet e leitor de PDF.
Referências
Referência fictícia.
AUDITA | SSMA & SGI • Gestão inteligente para ambientes mais seguros. • Elaboração: [TESTE]`;

const LAYOUT = `Módulo                                    Videoaula Leitura Atividades Total
01 • Ambientação                          8 min       7 min 5 min                      20 min
02 • Tema fictício de teste               60 min  25 min 15 min  100 min
Total                                     68 min  32 min 20 min  120 min (2 h)`;

describe("parseFicha", () => {
  it("lê título, versão, carga, instrutor, textos e os módulos com objetivos e minutos", () => {
    const f = parseFicha(FICHA, LAYOUT);
    expect(f).toMatchObject({
      title: "[TESTE] Curso Fictício de Verificação",
      version: "2.3",
      workload_minutes: 120,
      instructor_name: "[TESTE] Instrutor Fictício",
      modality: "100% EAD, assíncrono",
      audience: "Pessoas fictícias de teste",
      prerequisites: "Nenhum pré-requisito",
      general_objective: "Verificar a leitura da ficha técnica.",
      methodology: "Videoaula e apostila.",
      assessment_rules: "Atividades obrigatórias, sem nota.",
      important_notice: "Curso introdutório fictício.",
      resources: "Internet e leitor de PDF.",
      references_text: "Referência fictícia.",
    });
    expect(f.modules).toEqual([
      { position: 1, title: "Ambientação", objective: "Conhecer a plataforma.", content_summary: "Boas-vindas; como estudar.", video_minutes: 8, reading_minutes: 7, activity_minutes: 5 },
      { position: 2, title: "Tema fictício de teste", objective: "Aplicar conceitos fictícios.", content_summary: "Conceito A; conceito B.", video_minutes: 60, reading_minutes: 25, activity_minutes: 15 },
    ]);
  });
});
