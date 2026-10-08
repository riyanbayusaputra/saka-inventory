import { createClient } from "@/lib/supabase/server";

export type FormProduct = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  track_serial: boolean;
  pon_type: string | null;
};
export type FormSite = { id: string; name: string };

type Resp = { data: unknown[] | null; error: { message: string } | null };

// Supabase membatasi 1000 baris per query, jadi diambil bertahap
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<Resp>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await make(from, from + 999);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadFormData() {
  const supabase = await createClient();

  const [p, s, b, sn] = await Promise.all([
   // di fetchAll products, ubah tipe dan select:
fetchAll<{
  id: string; code: string; name: string; track_serial: boolean; pon_type: string | null;
  units: { name: string } | null;
}>((a, z) =>
  supabase.from("products")
    .select("id, code, name, track_serial, pon_type, units(name)")
    .eq("is_active", true).order("name").order("id").range(a, z)
),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
    fetchAll<{ product_id: string; site_id: string; quantity: number }>((a, z) =>
      supabase.from("stock_balances").select("product_id, site_id, quantity").order("id").range(a, z)
    ),
    fetchAll<{ product_id: string; site_id: string; serial_number: string }>((a, z) =>
      supabase.from("serial_numbers").select("product_id, site_id, serial_number")
        .eq("status", "IN_STOCK").order("serial_number").range(a, z)
    ),
  ]);

// di pemetaan products:
const products: FormProduct[] = p.map((x) => ({
  id: x.id, code: x.code, name: x.name,
  unit: x.units?.name ?? null, track_serial: x.track_serial, pon_type: x.pon_type,
}));

  const balances: Record<string, number> = {};
  b.forEach((r) => {
    balances[`${r.product_id}|${r.site_id}`] = Number(r.quantity);
  });

  // SN yang tersedia per barang dan site
  const serials: Record<string, string[]> = {};
  sn.forEach((r) => {
    const key = `${r.product_id}|${r.site_id}`;
    (serials[key] ??= []).push(r.serial_number);
  });

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return { products, sites: (s.data ?? []) as FormSite[], balances, serials, today };
}