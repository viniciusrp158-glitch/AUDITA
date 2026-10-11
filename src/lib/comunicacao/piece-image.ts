import "server-only";
import { isProduction } from "@/lib/env";
import { approvedLogo, downloadBrandFile, getOfficialContacts, type Piece, type PieceSnapshot } from "./queries";
import { pngSize } from "./png";
import { renderPiecePng, type PieceRenderInput, type RenderLogo } from "./render";

function toLogo(buf: Buffer | null): RenderLogo | null {
  if (!buf) return null;
  const s = pngSize(buf);
  return s ? { dataUri: `data:image/png;base64,${buf.toString("base64")}`, ...s } : null;
}

/** Prévia do rascunho: logo aprovado atual e contatos oficiais atuais. */
export async function renderDraft(p: Piece): Promise<Buffer> {
  const [logoV, contacts] = await Promise.all([approvedLogo(p.brand), p.show_contacts ? getOfficialContacts() : Promise.resolve(null)]);
  const logo = logoV ? toLogo(await downloadBrandFile(logoV.storage_path, logoV.sha256)) : null;
  const input: PieceRenderInput = {
    template: p.template,
    brand: p.brand,
    title: p.title,
    subtitle: p.subtitle,
    body: p.body,
    cta: p.cta,
    showSlogan: p.show_slogan,
    showContacts: p.show_contacts,
    contacts,
    logo,
    watermark: !isProduction || p.is_test || Boolean(logoV?.is_test) || Boolean(contacts?.is_test),
  };
  return renderPiecePng(input);
}

export type SnapshotRender = { png: Buffer; logoOk: boolean };

/** Versão congelada: usa exatamente o logo (conferido pelo SHA-256) e os contatos guardados no snapshot. */
export async function renderSnapshot(s: PieceSnapshot): Promise<SnapshotRender> {
  const logoBuf = s.logo ? await downloadBrandFile(s.logo.storage_path, s.logo.sha256) : null;
  const p = s.piece;
  const png = await renderPiecePng({
    template: p.template,
    brand: p.brand,
    title: p.title,
    subtitle: p.subtitle,
    body: p.body,
    cta: p.cta,
    showSlogan: p.show_slogan,
    showContacts: p.show_contacts,
    contacts: s.contacts,
    logo: toLogo(logoBuf),
    watermark: !isProduction || p.is_test || Boolean(s.logo?.is_test) || Boolean(s.contacts?.is_test),
  });
  return { png, logoOk: !s.logo || Boolean(logoBuf) };
}
