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