// AUDDOC004 Rev.01 — matriz atualizada com a situação comercial do catálogo do Sistema AUDITA (05/11/2026)
const fs = require("fs");
const path = require("path");
const JSZip = require("C:/Users/Vinicius Rocha/Documents/AUDITA/node_modules/jszip");

const ROOT = "C:/Users/Vinicius Rocha/Documents/AUDITA";
// Executado com a pasta que contém catalogo.json (exportado de audita.services em produção) como argumento
const SCR = process.argv[2] || path.dirname(__filename);
const SRC = `${ROOT}/_dossie/FASE1_DOCUMENTOS_APROVADOS/AUDDOC004/AUDDOC004_Matriz_Servicos_Responsabilidade_Tecnica_Rev00.xlsx`;
const OUT = `${SCR}/AUDDOC004_Matriz_Servicos_Responsabilidade_Tecnica_Rev01.xlsx`;
const BASE = "05/11/2026";
const catalog = Object.fromEntries(JSON.parse(fs.readFileSync(`${SCR}/catalogo.json`, "utf8")).map((s) => [s.service_code, s]));

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
let shared = [];

function cellRe(ref) {
  return new RegExp(`<x:c r="${ref}"(?: [^>]*?)?(?:/>|>.*?</x:c>)`);
}
function get(xml, ref) {
  const m = xml.match(cellRe(ref));
  if (!m) return "";
  const c = m[0];
  if (/t="s"/.test(c)) return shared[Number(c.match(/<x:v>(\d+)<\/x:v>/)[1])];
  const t = c.match(/<x:t[^>]*>(.*?)<\/x:t>/) || (/t="str"/.test(c) && c.match(/<x:v>(.*?)<\/x:v>/));
  return t ? unesc(t[1]) : "";
}
function set(xml, ref, text) {
  const style = (xml.match(cellRe(ref)) || [""])[0].match(/ s="(\d+)"/);
  const cell = `<x:c r="${ref}"${style ? ` s="${style[1]}"` : ""} t="inlineStr"><x:is><x:t xml:space="preserve">${esc(text)}</x:t></x:is></x:c>`;
  if (cellRe(ref).test(xml)) return xml.replace(cellRe(ref), cell);
  throw new Error("célula inexistente: " + ref);
}
function setStyled(xml, ref, text, styleFrom) {
  const s = (xml.match(cellRe(styleFrom)) || [""])[0].match(/ s="(\d+)"/);
  const row = ref.match(/\d+/)[0];
  const cell = `<x:c r="${ref}"${s ? ` s="${s[1]}"` : ""} t="inlineStr"><x:is><x:t xml:space="preserve">${esc(text)}</x:t></x:is></x:c>`;
  if (cellRe(ref).test(xml)) return xml.replace(cellRe(ref), cell);
  const rowRe = new RegExp(`<x:row r="${row}"([^>]*?)(/>|>(.*?)</x:row>)`);
  const m = xml.match(rowRe);
  if (!m) {
    const next = [...xml.matchAll(/<x:row r="(\d+)"/g)].map((x) => Number(x[1])).find((n) => n > Number(row));
    if (!next) throw new Error("linha inexistente: " + row);
    return xml.replace(`<x:row r="${next}"`, `<x:row r="${row}">${cell}</x:row><x:row r="${next}"`);
  }
  // células da linha em ordem de coluna
  const cells = (m[3] || "").match(/<x:c r="[A-Z]+\d+".*?(?:\/>|<\/x:c>)/g) || [];
  cells.push(cell);
  const col = (c) => c.match(/r="([A-Z]+)/)[1];
  cells.sort((a, b) => (col(a).length - col(b).length) || (col(a) < col(b) ? -1 : 1));
  return xml.replace(rowRe, `<x:row r="${row}"${m[1]}>${cells.join("")}</x:row>`);
}
const decisao = (s) => s.status_basis;

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(SRC));
  const ss = await zip.file("xl/sharedStrings.xml").async("string");
  shared = (ss.match(/<x:si>.*?<\/x:si>/g) || []).map((si) => unesc((si.match(/<x:t[^>]*>(.*?)<\/x:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  const sheet = async (n) => zip.file(`xl/worksheets/sheet${n}.xml`).async("string");
  const save = (n, x) => zip.file(`xl/worksheets/sheet${n}.xml`, x);

  // 1 — Orientações
  let s1 = await sheet(1);
  s1 = set(s1, "A4", `AUDDOC004 | Rev.01 — MATRIZ INTERNA VIGENTE (situação em ${BASE}) • 25 serviços e 12 ofertas de treinamento liberados por decisão do Diretor (14/10/2026); 8 itens não liberados.`);
  s1 = set(s1, "D10", "Serviços liberados");
  s1 = s1.replace(/(<x:c r="E10"[^>]*><x:f>[^<]*<\/x:f><x:v>)0(<\/x:v>)/, "$125$2");
  save(1, s1);

  // 2 — Matriz de Serviços
  let s2 = await sheet(2);
  s2 = set(s2, "A3", `AUDDOC004 — Rev.01 | Situação comercial atualizada em ${BASE} conforme as decisões do Diretor de 14/10/2026 (Caderno de pendências D3/D4), registradas no catálogo do Sistema AUDITA. Classes preliminares mantidas.`);
  let liberadosMatriz = 0;
  for (let r = 5; r <= 37; r++) {
    const code = get(s2, `A${r}`);
    const s = catalog[code];
    if (!s) throw new Error("serviço sem registro no catálogo: " + code);
    const yn = (v) => (v === "sim" ? "Sim" : "Não");
    s2 = set(s2, `J${r}`, yn(s.docs_received));
    s2 = set(s2, `K${r}`, yn(s.rt_confirmed));
    s2 = set(s2, `L${r}`, yn(s.resources_confirmed));
    const lib = s.commercial_status === "apto_comercialmente";
    if (lib) liberadosMatriz++;
    s2 = set(s2, `M${r}`, lib ? "Liberado" : "Não liberado");
    s2 = set(s2, `N${r}`, `${get(s2, `N${r}`)} | Rev.01 — ${lib ? `Liberado (apto comercialmente no Sistema AUDITA desde ${s.decided}): ${decisao(s)}` : `Não liberado em ${BASE}.`}`);
  }
  if (liberadosMatriz !== 25) throw new Error("contagem inesperada de liberados na matriz: " + liberadosMatriz);
  save(2, s2);

  // 3 — Habilitações
  let s3 = await sheet(3);
  s3 = set(s3, "C5", "Comprovado");
  s3 = set(s3, "E5", "14/10/2026");
  s3 = set(s3, "F5", `${get(s3, "F5")} Rev.01: cartão de 2023 considerado válido pelo Diretor em 14/10/2026 (Caderno de pendências D3/D4).`);
  s3 = set(s3, "C7", "Comprovado");
  s3 = setStyled(s3, "E7", "14/10/2026", "E5");
  s3 = set(s3, "F7", `${get(s3, "F7")} Rev.01: proficiência considerada suficiente pelo Diretor para as 12 ofertas por NR em 14/10/2026 (D3/D4); NR-33 e NR-35 liberadas com condições.`);
  s3 = set(s3, "C8", "Comprovado");
  s3 = set(s3, "E8", "14/10/2026");
  s3 = set(s3, "F8", `${get(s3, "F8")} Rev.01: comprovações consideradas válidas pelo Diretor em 14/10/2026 (D4); auditorias liberadas sem promessa de certificação.`);
  s3 = set(s3, "C13", "Em análise");
  s3 = setStyled(s3, "E13", BASE, "E5");
  s3 = set(s3, "F13", "Rev.01: empresa formalizada como MEI — CNPJ 69.563.249/0001-01, CNAE 8599-6/04, SIMEI (cartão CNPJ e ficha da JUCESP de 11/10/2026). Inscrição estadual não se aplica; inscrição municipal PENDENTE.");
  save(3, s3);

  // 5 — Treinamentos por NR
  let s5 = await sheet(5);
  s5 = set(s5, "A3", `AUDDOC004 — Rev.01 | 12 ofertas liberadas pelo Diretor em 14/10/2026 (D3/D4); NR-33 e NR-35 com condições registradas na situação preliminar. Situação em ${BASE}.`);
  for (let r = 5; r <= 16; r++) {
    const s = catalog[get(s5, `A${r}`)];
    s5 = set(s5, `N${r}`, `${get(s5, `N${r}`)} | Rev.01 — Liberado (apto comercialmente desde ${s.decided}): ${decisao(s)}`);
  }
  save(5, s5);

  // 6 — Pendências e Liberação
  let s6 = await sheet(6);
  s6 = set(s6, "A3", `AUDDOC004 — Rev.01 | Situação das etapas atualizada em ${BASE} conforme as decisões do Diretor de 14/10/2026 (D3/D4) e a formalização da empresa.`);
  const pend = {
    5: ["Atendido", "Rev.01: cartão de 2023 considerado válido pelo Diretor em 14/10/2026 (D3/D4)."],
    7: ["Atendido", "Rev.01: proficiência considerada suficiente pelo Diretor; ofertas liberadas em 14/10/2026 (D3/D4)."],
    8: ["Atendido", "Rev.01: TRN-NR11-E e TRN-NR11-P liberados como ofertas independentes em 14/10/2026."],
    9: ["Atendido", "Rev.01: TRN-NR20 liberado restrito ao Curso Básico em 14/10/2026."],
    10: ["Atendido", "Rev.01: TRN-NR33 liberado com condição registrada (RT, estrutura e prática) em 14/10/2026."],
    11: ["Atendido", "Rev.01: TRN-NR35 liberado com condição registrada (presencial e estrutura) em 14/10/2026."],
    12: ["Atendido", "Rev.01: orientações NR-23 (TRN-NR23) liberadas; formação de brigada (TRN-004) continua não liberada."],
    13: ["Atendido", "Rev.01: comprovações consideradas válidas pelo Diretor (D4); AUD-001 a AUD-004 liberados sem promessa de certificação."],
    14: ["Atendido", "Rev.01: DOC-001 a DOC-003 liberados com limites de escopo registrados no catálogo (14/10/2026)."],
    16: ["Parcial", "Rev.01: MEI formalizado (CNPJ 69.563.249/0001-01, CNAE 8599-6/04, SIMEI, 11/10/2026); inscrição municipal pendente."],
    17: ["Parcial", "Rev.01: modelos comerciais e contratuais aprovados no AUDDOC010 (09/10/2026); revisão jurídica ainda pendente."],
  };
  for (const [r, [st, note]] of Object.entries(pend)) {
    s6 = set(s6, `D${r}`, st);
    s6 = set(s6, `I${r}`, `${get(s6, `I${r}`)} ${note}`);
  }
  save(6, s6);

  // 7 — Controle de Revisões
  let s7 = await sheet(7);
  s7 = set(s7, "B5", "VIGENTE — documento interno (situação comercial conforme as decisões do Diretor de 14/10/2026)");
  s7 = set(s7, "B6", "Rev.01");
  s7 = set(s7, "B7", "Rev.01: conforme registro de publicação na Biblioteca do Sistema AUDITA (Rev.00 em 08/10/2026)");
  s7 = set(s7, "B9", "Rev.00: aprovação expressa em conversa, 08/10/2026. Rev.01: aprovação registrada na Biblioteca do Sistema AUDITA. Não constitui assinatura eletrônica.");
  s7 = setStyled(s7, "B14", "08/10/2026", "B13");
  s7 = setStyled(s7, "C14", "Emissão inicial da matriz interna; nenhum serviço liberado para comercialização.", "C13");
  s7 = setStyled(s7, "D14", "Substituída pela Rev.01", "D13");
  for (const [col, text] of [["A", "Rev.01"], ["B", BASE], ["C", "Situação comercial (coluna M), documentos/RT/recursos (J–L) e observações atualizados conforme o catálogo do Sistema AUDITA (decisões do Diretor de 14/10/2026); habilitações, pendências, treinamentos e materiais atualizados; formalização MEI registrada. Elaboração assistida (Claude)."], ["D", "Vigente após aprovação na Biblioteca"]]) {
    s7 = setStyled(s7, `${col}15`, text, `${col}13`);
  }
  save(7, s7);

  // 8 — Materiais dos Cursos
  let s8 = await sheet(8);
  s8 = set(s8, "A3", `AUDDOC004 — Rev.01 | Ofertas liberadas comercialmente em 14/10/2026; o andamento de cada material didático continua controlado nesta aba. Situação em ${BASE}.`);
  for (let r = 5; r <= 16; r++) s8 = set(s8, `J${r}`, "Liberado");
  save(8, s8);

  // Recalcular fórmulas ao abrir
  let wb = await zip.file("xl/workbook.xml").async("string");
  if (!/calcPr/.test(wb)) wb = wb.replace("</x:sheets>", '</x:sheets><x:calcPr fullCalcOnLoad="1" />');
  zip.file("xl/workbook.xml", wb);

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(OUT, buf);
  console.log(OUT, buf.length);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
