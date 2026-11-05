// AUDDOC003 Rev.01 — inclusão das versões negativas oficiais (pedido do Diretor em 05/11/2026)
const fs = require("fs");
const path = require("path");
const JSZip = require("C:/Users/Vinicius Rocha/Documents/AUDITA/node_modules/jszip");

const ROOT = "C:/Users/Vinicius Rocha/Documents/AUDITA";
// Executado da pasta temporária com os PNGs negativos em ./logos (convertidos de site/public/images/marca/*.webp)
const SCR = process.argv[2] || path.dirname(__filename);
const SRC = `${ROOT}/_dossie/FASE1_DOCUMENTOS_APROVADOS/AUDDOC003/AUDDOC003_Manual_Identidade_Visual_AUDITA_Rev00.docx`;
const OUT = `${SCR}/AUDDOC003_Manual_Identidade_Visual_AUDITA_Rev01.docx`;
const DATE = "05/11/2026";

function rep(s, a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`esperava 1 ocorrência, achei ${n}: ${a.slice(0, 90)}`);
  return s.split(a).join(b);
}
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const p = (t, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const bullet = (t) => `<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:spacing w:after="40"/></w:pPr><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const pic = (rid, id, name, cx, cy) =>
  `<w:p><w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(SRC));
  let doc = await zip.file("word/document.xml").async("string");

  // Imagens negativas (convertidas do WebP em uso no site, sem alteração do desenho)
  const logos = [
    { file: "audita-negativa.png", rid: "rId17", id: 201, w: 400, h: 139, cx: 2880000 },
    { file: "pro-negativa.png", rid: "rId18", id: 202, w: 720, h: 165, cx: 3780000 },
    { file: "hub-negativa.png", rid: "rId19", id: 203, w: 720, h: 167, cx: 3780000 },
  ];
  let rels = await zip.file("word/_rels/document.xml.rels").async("string");
  logos.forEach((l, i) => {
    zip.file(`word/media/image${7 + i}.png`, fs.readFileSync(`${SCR}/logos/${l.file}`));
    rels = rels.replace("</Relationships>", `<Relationship Id="${l.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${7 + i}.png"/></Relationships>`);
  });
  zip.file("word/_rels/document.xml.rels", rels);

  // Capa e controle documental
  doc = rep(doc, "Situação: documento aprovado pela AUDITA e emitido como Rev.00, incluindo o capítulo de gráficos e indicadores. Aprovação institucional registrada em 08/10/2026.",
    `Situação: documento aprovado pela AUDITA. Rev.00 emitida em 08/10/2026; Rev.01 emitida em ${DATE}, com as versões negativas oficiais dos logotipos.`);
  doc = rep(doc, "<w:t>Rev.00 — Emissão inicial</w:t>", "<w:t>Rev.01 — Inclusão das versões negativas dos logotipos</w:t>");
  doc = rep(doc, "<w:t>Vigente — aprovado</w:t>", "<w:t>Vigente — aprovado (substitui a Rev.00)</w:t>");
  doc = rep(doc, "Três logotipos em PNG fornecidos e aprovados pela AUDITA", "Três logotipos em PNG fornecidos e aprovados pela AUDITA e suas versões negativas oficiais (Rev.01)");
  {
    const k = doc.indexOf("Data de aprovação e emissão");
    const d = doc.indexOf("<w:t>08/10/2026</w:t>", k);
    if (k < 0 || d < 0 || d - k > 1500) throw new Error("data de aprovação não encontrada");
    doc = doc.slice(0, d) + `<w:t>${DATE} (Rev.01) — emissão inicial (Rev.00) em 08/10/2026</w:t>` + doc.slice(d + "<w:t>08/10/2026</w:t>".length);
  }
  doc = rep(doc, "integram esta emissão controlada Rev.00.", "integram esta emissão controlada Rev.01.");

  // 06 — Reprodução
  doc = rep(doc, "Como os arquivos oficiais atuais são PNGs com fundo branco, o uso sobre fundos escuros exige um tratamento técnico controlado, sem alterar o desenho.",
    "Os arquivos originais são PNGs com fundo branco. Sobre fundos escuros, use a versão negativa oficial (incluída na Rev.01); a composição da marca original sobre área branca de proteção continua permitida.");
  const oldVariants = "<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Variantes planejadas</w:t></w:r></w:p><w:p><w:r><w:t>Positiva (original), PNG recortado, PNG com transparência verificada, SVG vetorizado fiel, versão monocromática controlada e versão negativa para fundo escuro — todas sujeitas a inspeção e validação antes de distribuição.</w:t></w:r></w:p>";
  const navyTable = `<w:tbl><w:tblPr><w:tblW w:type="auto" w:w="0"/><w:tblLook w:firstColumn="1" w:firstRow="1" w:lastColumn="0" w:lastRow="0" w:noHBand="0" w:noVBand="1" w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:type="dxa" w:w="9638"/><w:shd w:fill="031B35"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:start w:w="180" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:end w:w="180" w:type="dxa"/></w:tcMar></w:tcPr>${logos
    .map((l) => pic(l.rid, l.id, l.file, l.cx, Math.round((l.cx * l.h) / l.w)))
    .join("")}</w:tc></w:tr></w:tbl>`;
  const newVariants =
    p("Versões negativas oficiais — fundo escuro", "Heading2") +
    p("A partir da Rev.01, AUDITA, Audita PRO e Audita HUB têm versão negativa oficial para aplicação sobre fundo azul-marinho (#031B35) ou outro fundo escuro de contraste equivalente. Estas versões já estão em uso no site institucional da AUDITA.") +
    navyTable +
    p("Versões negativas oficiais sobre azul-marinho #031B35, reproduzidas dos arquivos em uso no site institucional.", "AUDCaption") +
    p("Regras da versão negativa", "Heading2") +
    bullet("Derivados técnicos dos PNGs oficiais, sem alteração de desenho: a palavra “audita” e os losangos azul-marinho dos emblemas passam a branco, e os ícones desses losangos passam a azul-marinho.") +
    bullet("Permanecem idênticos ao original: a folha verde, os termos PRO e HUB, os losangos coloridos (azul PRO e verde HUB) e seus ícones brancos.") +
    bullet("Arquivos com fundo transparente; legibilidade verificada sobre azul-marinho e sobre preto, nos tamanhos mínimos digitais deste manual.") +
    bullet("Usar somente sobre azul-marinho (#031B35) ou fundo escuro equivalente; sobre fundo claro, usar sempre a versão positiva (original).") +
    bullet("Usar apenas os arquivos oficiais; não gerar a versão negativa invertendo cores, aplicando filtros ou redesenhando elementos.") +
    bullet("Sobre fotografias, aplicar em área escura uniforme ou sob camada azul-marinho que garanta a leitura.") +
    bullet("Área de proteção, dimensões mínimas e usos proibidos são os mesmos da versão positiva.") +
    p("Situação das variantes", "Heading1") +
    p("Oficiais: positiva (original) e negativa para fundo escuro (Rev.01). Planejadas, sujeitas a inspeção e validação antes de distribuição: PNG com transparência verificada para impressão, SVG vetorizado fiel e versão monocromática controlada.");
  doc = rep(doc, oldVariants, newVariants);

  // 12 — Arquivos de distribuição: nova linha (cópia da linha DOCX editável)
  const docxCell = doc.indexOf("<w:t>DOCX editável</w:t>");
  const rowStart = doc.lastIndexOf("<w:tr>", docxCell);
  const rowEnd = doc.indexOf("</w:tr>", docxCell) + 7;
  const row = doc.slice(rowStart, rowEnd);
  const negRow = rep(rep(rep(row, "<w:t>DOCX editável</w:t>", "<w:t>Negativo (PNG / WebP)</w:t>"),
    "<w:t>Manual, documentos e materiais controlados.</w:t>", "<w:t>Site, telas e peças com fundo escuro.</w:t>"),
    "<w:t>Seguir o PDA e versionamento.</w:t>", "<w:t>Somente os arquivos oficiais da Rev.01.</w:t>");
  doc = doc.slice(0, rowEnd) + negRow + doc.slice(rowEnd);

  // 13 — Validação e histórico
  doc = rep(doc, "Esta Rev.00 constitui a primeira emissão institucional do documento.", "A Rev.00 constituiu a primeira emissão institucional do documento; a Rev.01 incorpora as versões negativas oficiais dos logotipos.");
  doc = rep(doc, "Diretriz aprovada; versões técnicas em preparação.", "Versões negativas oficiais incorporadas na Rev.01 (seção 06).");
  const emisCell = doc.indexOf("<w:t>Emissão AUDDOC003 — Rev.00</w:t>");
  const eStart = doc.lastIndexOf("<w:tr>", emisCell);
  const eEnd = doc.indexOf("</w:tr>", emisCell) + 7;
  const eRow = rep(rep(doc.slice(eStart, eEnd), "Emissão AUDDOC003 — Rev.00", "Emissão AUDDOC003 — Rev.01"),
    "Rev.00 emitida em 08/10/2026; aprovação por Vinicius Rocha Pereira — Diretor.", `Rev.01 emitida em ${DATE}; aprovação por Vinicius Rocha Pereira — Diretor.`);
  doc = doc.slice(0, eEnd) + eRow + doc.slice(eEnd);

  const histCell = doc.indexOf("<w:t>Emissão do manual completo aprovado em 08/10/2026");
  const hStart = doc.lastIndexOf("<w:tr>", histCell);
  const hEnd = doc.indexOf("</w:tr>", histCell) + 7;
  const hOld = doc.slice(hStart, hEnd);
  const hRev00 = rep(hOld, "<w:t>Vigente — emissão inicial</w:t>", "<w:t>Substituída pela Rev.01</w:t>");
  const hRev01 = rep(rep(rep(hOld, "<w:t>Rev.00</w:t>", "<w:t>Rev.01</w:t>"), "<w:t>Vigente — emissão inicial</w:t>", "<w:t>Vigente — revisão</w:t>"),
    "Emissão do manual completo aprovado em 08/10/2026, incorporando diretrizes de marca e gráficos.",
    `Inclusão das versões negativas oficiais (fundo escuro) das três marcas, já em uso no site institucional; aprovada em ${DATE}.`);
  doc = doc.slice(0, hStart) + hRev00 + hRev01 + doc.slice(hEnd);

  doc = rep(doc, "Emissão inicial aprovada por Vinicius Rocha Pereira — Diretor, em 08/10/2026.",
    `Emissão inicial aprovada por Vinicius Rocha Pereira — Diretor, em 08/10/2026. Rev.01 aprovada por Vinicius Rocha Pereira — Diretor, em ${DATE}.`);
  zip.file("word/document.xml", doc);

  for (const f of ["word/header1.xml", "word/footer1.xml"]) {
    const x = await zip.file(f).async("string");
    zip.file(f, rep(x, "Rev.00", "Rev.01"));
  }

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(OUT, buf);
  console.log(OUT, buf.length);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
