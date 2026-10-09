"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export async function registerSerials(
  productId: string,
  siteId: string,
  raw: string
): Promise<{ error?: string; count?: number }> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin" };
  if (!productId || !siteId) return { error: "Pilih barang dan site" };

  const list = raw
    .split(/[\n\r,;\t]+/)
    .map((s) => s.replace(/\s+/g, "").toUpperCase())
    .filter(Boolean);
  if (!list.length) return { error: "Isi minimal satu nomor SN" };
  if (list.length > 500) return { error: "Maksimal 500 SN sekali proses" };
  if (new Set(list).size !== list.length) return { error: "Ada SN ganda pada daftar" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_serials", {
    p_product: productId,
    p_site: siteId,
    p_serials: list,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory", "layout");
  return { count: Number(data) };
}
export async function lookupSerial(raw: string): Promise<{
  found: boolean;
  product_id?: string;
  product_name?: string;
  status?: "IN_STOCK" | "OUT";
  site_id?: string | null;
  site_name?: string | null;
}> {
  const profile = await getProfile();
  if (!profile) return { found: false };

  const sn = raw.replace(/\s+/g, "").toUpperCase();
  if (!sn || sn.length > 64) return { found: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("serial_numbers")
    .select("product_id, status, site_id, products(name), sites:sites!serial_numbers_site_id_fkey(name)")
    .eq("serial_number", sn)
    .maybeSingle();
  if (!data) return { found: false };

  const d = data as unknown as {
    product_id: string;
    status: "IN_STOCK" | "OUT";
    site_id: string | null;
    products: { name: string } | null;
    sites: { name: string } | null;
  };
  return {
    found: true,
    product_id: d.product_id,
    product_name: d.products?.name,
    status: d.status,
    site_id: d.site_id,
    site_name: d.sites?.name ?? null,
  };
}