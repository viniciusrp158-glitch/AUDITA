import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Texto de um PDF pelo pdftotext (poppler-utils, instalado na imagem do sistema). O leitor de PDF em JavaScript perde
 * hífens, parênteses e marcadores das fontes do pacote L01; o pdftotext os preserva. PDFTOTEXT_PATH troca o executável.
 */
export async function pdfToText(data: Uint8Array): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "audita-pdf-"));
  const file = join(dir, "arquivo.pdf");
  try {
    await writeFile(file, data);
    return await new Promise<string>((resolve, reject) =>
      execFile(process.env.PDFTOTEXT_PATH || "pdftotext", ["-enc", "UTF-8", "-q", file, "-"], { maxBuffer: 10 * 1024 * 1024, timeout: 30_000 }, (err, out) =>
        err ? reject(err) : resolve(out),
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
