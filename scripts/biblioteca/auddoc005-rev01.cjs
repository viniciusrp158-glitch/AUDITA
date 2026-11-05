// AUDDOC005 Rev.01 — situação comercial atualizada a partir do catálogo do Sistema AUDITA (05/11/2026)
const fs = require("fs");
const path = require("path");
const JSZip = require("C:/Users/Vinicius Rocha/Documents/AUDITA/node_modules/jszip");

const ROOT = "C:/Users/Vinicius Rocha/Documents/AUDITA";
// Executado com a pasta que contém catalogo.json (exportado de audita.services em produção) como argumento
const SCR = process.argv[2] || path.dirname(__filename);
const SRC = `${ROOT}/_dossie/FASE1_DOCUMENTOS_APROVADOS/AUDDOC005/AUDDOC005_Catalogo_Mestre_de_Servicos_AUDITA_Rev00.docx`;
const OUT = `${SCR}/AUDDOC005_Catalogo_Mestre_de_Servicos_AUDITA_Rev01.docx`;
const BASE = "05/11/2026";
const APPROVAL = "conforme registro de publicação na Biblioteca do Sistema AUDITA";
const catalog = JSON.parse(fs.readFileSync(`${SCR}/catalogo.json`, "utf8"));

function rep(s, a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`esperava 1 ocorrência, achei ${n}: ${a.slice(0, 90)}`);
  return s.split(a).join(b);
}
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wt = (t) => `<w:t>${esc(t)}</w:t>`;
function rowAt(doc, marker) {
  const i = doc.indexOf(marker);
  if (i < 0) throw new Error("linha não encontrada: " + marker);
  const a = doc.lastIndexOf("<w:tr>", i);
  const b = doc.indexOf("</w:tr>", i) + 7;
  return [a, b, doc.slice(a, b)];
}

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(SRC));
  let doc = await zip.file("word/document.xml").async("string");

  const liberados = catalog.filter((s) => s.commercial_status === "apto_comercialmente");
  const servicos = liberados.filter((s) => s.kind === "servico").length;
  const ofertas = liberados.filter((s) => s.kind === "oferta").length;
  const naoLib = catalog.filter((s) => s.commercial_status !== "apto_comercialmente").map((s) => s.service_code);

  // Identificação
  doc = rep(doc, wt("Rev.00 — emissão inicial"), wt("Rev.01 — atualização da situação comercial dos serviços"));
  doc = rep(doc, wt("AUDDOC004 — Rev.00 (matriz de referência)"), wt("AUDDOC004 — Rev.01 (matriz de referência)"));
  {
    const k = doc.indexOf("Data de aprovação e emissão");
    const d = doc.indexOf("<w:t>08/10/2026</w:t>", k);
    if (d - k > 1500) throw new Error("data não encontrada");
    doc = doc.slice(0, d) + wt(`Rev.01: ${APPROVAL} — Rev.00 em 08/10/2026`) + doc.slice(d + "<w:t>08/10/2026</w:t>".length);
  }
  doc = rep(doc, "Este catálogo é um instrumento interno aprovado de definição e organização dos serviços. NÃO representa oferta comercial vigente, tabela de preços ou confirmação de atribuição técnica individual. A disponibilização pública depende de liberação por serviço, formalização empresarial e revisão aplicável.",
    "Este catálogo é um instrumento interno aprovado de definição e organização dos serviços. A situação comercial de cada serviço é a decidida pelo Diretor e registrada, com fundamento e data, no catálogo do Sistema AUDITA (seção 3.1); a AUDDOC019 — Lista Mestra de Serviços e Treinamentos publica essa situação a cada mudança. Este documento não é tabela de preços: os valores seguem a metodologia do AUDDOC011 e, sem parâmetro definido, ficam PENDENTES. A divulgação pública continua restrita aos serviços liberados.");
  doc = rep(doc, "Base documental: AUDDOC004 — Matriz de Serviços e Responsabilidade Técnica, Rev.00, aprovado em 08/10/2026.",
    "Base documental: AUDDOC004 — Matriz de Serviços e Responsabilidade Técnica, Rev.01 (Rev.00 aprovada em 08/10/2026).");

  // 3. Situação do portfólio
  doc = rep(doc, wt("SITUAÇÃO EM 08/10/2026"), wt(`SITUAÇÃO EM ${BASE}`));
  doc = rep(doc, wt("Nenhum serviço liberado; CNPJ e requisitos por serviço pendentes"),
    wt(`${servicos} serviços e ${ofertas} ofertas de treinamento aptos comercialmente (decisão do Diretor em 14/10/2026); não liberados: ${naoLib.join(", ")}. Empresa formalizada como MEI (CNPJ 69.563.249/0001-01)`));

  // 3.1 Situação comercial por serviço (nova), antes da seção 4
  const tStart = doc.lastIndexOf("<w:tbl>", doc.indexOf("<w:t>SST-001</w:t>"));
  const tEnd = doc.indexOf("</w:tbl>", tStart) + 8;
  const parts = doc.slice(tStart, tEnd).split("<w:tr>");
  const tblHead = parts[0];
  let header = "<w:tr>" + parts[1];
  header = rep(rep(rep(header, wt("CÓDIGO"), wt("CÓDIGO")), wt("SERVIÇO / LINHA"), wt("SERVIÇO / OFERTA")), wt("ESCOPO PRELIMINAR / LIMITES"), wt("SITUAÇÃO COMERCIAL E FUNDAMENTO"));
  const tplRow = "<w:tr>" + parts[2].replace("</w:tbl>", "");
  const situacao = (s) => {
    if (s.commercial_status === "apto_comercialmente") {
      const preco = s.pricing_model === "sem_modelo_definido" ? "preço SaaS sem modelo definido (PENDENTE, sem cálculo automático)" : "preço por hora técnica (AUDDOC011)";
      const cond = s.matrix_class_label && s.matrix_class_label.includes("Condicionado") ? ` Condição: ${s.matrix_class_label.replace(/^B — Condicionado /, "").replace(/[()]/g, "")}.` : "";
      return `Apto comercialmente — decisão do Diretor em 14/10/2026 (D3/D4), registrada em ${s.decided}; ${preco}.${cond}`;
    }
    return s.matrix_class_label.startsWith("C") ? "Não liberado — expansão futura (depende de parceiro ou profissional habilitado)." : "Não liberado — situação da Rev.00 mantida; sem decisão de liberação.";
  };
  const rows = catalog.map((s) => {
    let r = tplRow;
    r = rep(r, wt("SST-001"), wt(s.service_code));
    r = rep(r, wt("Consultoria recorrente de SST para pequenas empresas"), wt(s.name));
    r = rep(r, wt("Visitas, orientação, registros e acompanhamento; não substitui automaticamente SESMT dimensionado"), wt(situacao(s)));
    return r;
  });
  const newSection =
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/></w:pPr><w:r>${wt(`3.1. Situação comercial por serviço (${BASE})`)}</w:r></w:p>` +
    `<w:p><w:r>${wt("Extraída do catálogo do Sistema AUDITA. Os fundamentos completos de cada decisão (registro profissional, limites de escopo e referências) ficam registrados no próprio catálogo e na AUDDOC004 Rev.01.")}</w:r></w:p>` +
    tblHead + header + rows.join("") + "</w:tbl>";
  const h4 = doc.indexOf("<w:t>4. Regras para as fichas comerciais</w:t>");
  const h4p = doc.lastIndexOf("<w:p>", h4);
  doc = doc.slice(0, h4p) + newSection + doc.slice(h4p);

  // 14. Matriz de decisão
  doc = rep(doc, wt("Situação atual de todos os serviços; mantém-se na AUDDOC004."), wt(`Situação em ${BASE} de ${naoLib.join(", ")}.`));
  doc = rep(doc, wt("Após regularização PJ, documentação comercial, contratos, preços e validação final."),
    wt(`Após regularização PJ, documentação comercial, contratos, preços e validação final. Situação de ${servicos} serviços e ${ofertas} ofertas de treinamento desde 15/10/2026.`));

  // 15. Pendências
  doc = rep(doc, wt("□  Formalizar CNPJ e demais condições empresariais antes da operação PJ."),
    wt("☑  CNPJ formalizado (MEI, 69.563.249/0001-01, cartão CNPJ e JUCESP de 11/10/2026). Inscrição municipal ainda pendente."));
  doc = rep(doc, wt("□  Concluir análise por NR dos 12 treinamentos, especialmente níveis, atividades práticas e documentação do instrutor."),
    wt("☑  12 ofertas de treinamento por NR avaliadas e liberadas pelo Diretor em 14/10/2026 (D3/D4); NR-33 e NR-35 com condições registradas (seção 3.1)."));
  doc = rep(doc, wt("□  Conferir atribuições e responsabilidades técnicas, incluindo validação profissional/legal quando aplicável."),
    wt("☑  Atribuições e responsabilidades técnicas decididas pelo Diretor (D3/D4), com fundamento registrado por serviço no catálogo do Sistema AUDITA."));

  // 16. Controle
  const [ha, hb, hrow] = rowAt(doc, "Emissão inicial aprovada do Catálogo Mestre");
  let r01 = rep(hrow, wt("Rev.00"), wt("Rev.01"));
  r01 = rep(r01, wt("08/10/2026"), wt(BASE));
  r01 = rep(r01, wt("Emissão inicial aprovada do Catálogo Mestre para uso interno. Pendências operacionais e restrições comerciais preservadas."),
    wt("Situação comercial atualizada conforme o catálogo do Sistema AUDITA (decisões do Diretor de 14/10/2026), nova seção 3.1, pendências concluídas marcadas e referência à AUDDOC019. Elaboração assistida (Claude); aprovação registrada na Biblioteca do Sistema AUDITA."));
  doc = doc.slice(0, hb) + r01 + doc.slice(hb);
  doc = rep(doc, "e emitido como Rev.00. A aprovação formaliza seu conteúdo e sua estrutura como referência interna, sem liberar serviços para venda ou constituir assinatura ele",
    "e emitido como Rev.00. A Rev.01 atualiza a situação comercial dos serviços; sua aprovação fica registrada na Biblioteca do Sistema AUDITA. A aprovação formaliza seu conteúdo e sua estrutura como referência interna, sem constituir assinatura ele");
  doc = rep(doc, "sem alterar a AUDDOC004 Rev.00 retroativamente", "sem alterar retroativamente as revisões emitidas da AUDDOC004");

  zip.file("word/document.xml", doc);
  zip.file("word/header1.xml", rep(await zip.file("word/header1.xml").async("string"), "Rev.00", "Rev.01"));
  zip.file("word/footer1.xml", rep(await zip.file("word/footer1.xml").async("string"), "Rev.00  |  08/10/2026", `Rev.01  |  ${BASE}`));
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(OUT, buf);
  console.log(OUT, buf.length, { servicos, ofertas, naoLib });
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
