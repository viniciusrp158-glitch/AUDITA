import { NextResponse, type NextRequest } from "next/server";
import { prepareTrainingUploadAction, registerTrainingFileAction } from "../../actions";

/**
 * Envio dos arquivos do importador de pacote: as mesmas regras do envio manual (prepara o link assinado; depois o
 * servidor baixa, calcula o SHA-256 e registra), por rota comum para os envios correrem em paralelo (as ações do
 * servidor chamadas pelo navegador são executadas uma de cada vez).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const courseId = String(body.courseId ?? "");
  const versionId = String(body.versionId ?? "");
  const kind = String(body.kind ?? "");
  const moduleId = body.moduleId ? String(body.moduleId) : null;
  const fileName = String(body.fileName ?? "");
  if (body.step === "prepare") {
    return NextResponse.json(await prepareTrainingUploadAction(courseId, versionId, { kind, moduleId, fileName, size: Number(body.size ?? 0) }));
  }
  if (body.step === "register") {
    return NextResponse.json(await registerTrainingFileAction(courseId, versionId, { kind, moduleId, fileName, path: String(body.path ?? "") }));
  }
  return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
}
