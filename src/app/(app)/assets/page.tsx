import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AssetManager, type Asset } from "@/components/assets/asset-manager";

export default async function AssetsPage() {
  const profile = await requireRole(["ADMIN", "VIEWER"]);
  const supabase = await createClient();

  const [assets, sites] = await Promise.all([
    supabase.from("assets").select("*").order("code").limit(1000),
    supabase.from("sites").select("name").eq("is_active", true).order("name"),
  ]);

  if (assets.error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Aset &amp; Inventaris</h1>
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Data aset belum bisa dimuat: {assets.error.message}. Pastikan SQL aset sudah dijalankan di Supabase.
        </p>
      </div>
    );
  }

  const rows: Asset[] = (assets.data ?? []).map((a) => ({
    id: a.id,
    code: a.code,
    acquired_date: a.acquired_date,
    asset_type: a.asset_type,
    name: a.name,
    model_serial: a.model_serial,
    qty: Number(a.qty),
    price: Number(a.price),
    installment: Number(a.installment),
    description: a.description,
    location: a.location,
    is_active: a.is_active,
  }));

  return (
    <AssetManager
      rows={rows}
      siteNames={(sites.data ?? []).map((s) => s.name as string)}
      canEdit={profile.role === "ADMIN"}
    />
  );
}