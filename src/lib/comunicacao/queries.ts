import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  AssetVariant,
  AssetVersionStatus,
  Brand,
  CampaignStatus,
  Channel,
  PieceStatus,
  Template,
  VersionStatus,
} from "./labels";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BRAND_BUCKET = "audita-marca";

export type Piece = {
  id: string;
  piece_code: string;
  campaign_id: string | null;
  template: Template;
  brand: Brand;
  theme: string;
  objective: string | null;
  audience: string | null;
  channel: Channel;
  service_id: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  cta: string | null;
  show_slogan: boolean;
  show_contacts: boolean;
  caption: string | null;
  status: PieceStatus;
  current_version: number;
  status_note: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type PieceSnapshot = {
  schema: number;
  frozen_at: string;
  piece: Omit<Piece, "status" | "status_note" | "current_version" | "created_at" | "updated_at">;
  campaign: { id: string; campaign_code: string; name: string } | null;
  service: { id: string; service_code: string; name: string; commercial_status: string } | null;
  logo: { version_id: string; asset_id: string; version: number; storage_path: string; sha256: string; width: number | null; height: number | null; is_test: boolean } | null;
  contacts: { profile_version: number; email: string | null; phone: string | null; website: string | null; is_test: boolean } | null;
};

export type PieceVersion = {
  id: string;
  piece_id: string;
  version: number;
  status: VersionStatus;
  snapshot: PieceSnapshot;
  submitted_at: string;
  submitted_by: string | null;
  checklist: Record<string, boolean> | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  is_test: boolean;
};

export type Campaign = {
  id: string;
  campaign_code: string;
  name: string;
  objective: string | null;
  audience: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: CampaignStatus;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type BrandAsset = {
  id: string;
  brand: Brand;
  variant: AssetVariant;
  title: string;
  notes: string | null;
  status: "ativo" | "inativo";
  created_at: string;
};

export type BrandAssetVersion = {
  id: string;
  asset_id: string;
  version: number;
  status: AssetVersionStatus;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  source_note: string;
  status_note: string | null;
  approved_at: string | null;
  is_test: boolean;
  created_at: string;
};

export type ServiceOption = { id: string; service_code: string; name: string; commercial_status: string };
export type OfficialContacts = { profile_version: number; email: string | null; phone: string | null; website: string | null; is_test: boolean } | null;

export async function listPieces(filter: { status?: string; campaign?: string } = {}): Promise<Piece[]> {
  const supabase = await createClient();
  let q = supabase.from("comm_pieces").select("*").order("updated_at", { ascending: false }).limit(200);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.campaign && uuidRe.test(filter.campaign)) q = q.eq("campaign_id", filter.campaign);
  const { data } = await q;
  return (data ?? []) as Piece[];
}

export async function getPieceOr404(id: string): Promise<Piece> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("comm_pieces").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Piece;
}

export async function listPieceVersions(pieceId: string): Promise<PieceVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("comm_piece_versions").select("*").eq("piece_id", pieceId).order("version", { ascending: false });
  return (data ?? []) as PieceVersion[];
}

export async function getPieceVersion(pieceId: string, version: number): Promise<PieceVersion | null> {
  if (!uuidRe.test(pieceId) || !Number.isInteger(version) || version < 1) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("comm_piece_versions").select("*").eq("piece_id", pieceId).eq("version", version).maybeSingle();
  return (data as PieceVersion) ?? null;
}

export async function listPieceExports(pieceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comm_exports")
    .select("id, version_id, format, sha256, size_bytes, exported_at, exported_by")
    .eq("piece_id", pieceId)
    .order("exported_at", { ascending: false });
  return (data ?? []) as { id: string; version_id: string; format: "png" | "pdf"; sha256: string; size_bytes: number; exported_at: string; exported_by: string | null }[];
}

export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("comm_campaigns").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Campaign[];
}

export async function getCampaignOr404(id: string): Promise<Campaign> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("comm_campaigns").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Campaign;
}

export async function listServiceOptions(): Promise<ServiceOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("comm_service_options");
  return (data ?? []) as ServiceOption[];
}

export async function getOfficialContacts(): Promise<OfficialContacts> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("comm_official_contacts");
  return (data ?? null) as OfficialContacts;
}

export async function listBrandAssets(): Promise<(BrandAsset & { versions: BrandAssetVersion[] })[]> {
  const supabase = await createClient();
  const [{ data: assets }, { data: versions }] = await Promise.all([
    supabase.from("brand_assets").select("*").order("brand").order("variant").order("title"),
    supabase.from("brand_asset_versions").select("*").order("version", { ascending: false }),
  ]);
  const vs = (versions ?? []) as BrandAssetVersion[];
  return ((assets ?? []) as BrandAsset[]).map((a) => ({ ...a, versions: vs.filter((v) => v.asset_id === a.id) }));
}

export async function getBrandAssetOr404(id: string): Promise<BrandAsset & { versions: BrandAssetVersion[] }> {
  if (!uuidRe.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("brand_assets").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const { data: versions } = await supabase.from("brand_asset_versions").select("*").eq("asset_id", id).order("version", { ascending: false });
  return { ...(data as BrandAsset), versions: (versions ?? []) as BrandAssetVersion[] };
}

/** Logo aprovado da marca, na mesma ordem de preferência do banco (PNG transparente, depois PNG original). */
export async function approvedLogo(brand: Brand): Promise<BrandAssetVersion | null> {
  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("brand_assets")
    .select("id, variant")
    .eq("brand", brand)
    .eq("status", "ativo")
    .in("variant", ["png_transparente", "original_png"]);
  if (!assets?.length) return null;
  const { data: versions } = await supabase
    .from("brand_asset_versions")
    .select("*")
    .in(
      "asset_id",
      assets.map((a) => a.id),
    )
    .eq("status", "aprovado")
    .eq("mime_type", "image/png")
    .order("approved_at", { ascending: false });
  const rank = (v: BrandAssetVersion) => (assets.find((a) => a.id === v.asset_id)?.variant === "png_transparente" ? 0 : 1);
  return ((versions ?? []) as BrandAssetVersion[]).sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** Baixa um arquivo de marca (com a permissão de quem está logado) e confere o SHA-256 gravado. */
export async function downloadBrandFile(path: string, sha256: string): Promise<Buffer | null> {
  const { createHash } = await import("node:crypto");
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BRAND_BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return createHash("sha256").update(buf).digest("hex") === sha256 ? buf : null;
}
