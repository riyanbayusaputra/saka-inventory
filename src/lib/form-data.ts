import { createClient } from "@/lib/supabase/server";

export type FormProduct = { id: string; code: string; name: string; unit: string | null };
export type FormSite = { id: string; name: string };

export async function loadFormData() {
  const supabase = await createClient();
  const [p, s, b] = await Promise.all([
    supabase
      .from("products")
      .select("id, code, name, units(name)")
      .eq("is_active", true)
      .order("name"),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
    supabase.from("stock_balances").select("product_id, site_id, quantity"),
  ]);

  const products: FormProduct[] = ((p.data ?? []) as unknown as {
    id: string; code: string; name: string; units: { name: string } | null;
  }[]).map((x) => ({ id: x.id, code: x.code, name: x.name, unit: x.units?.name ?? null }));

  const balances: Record<string, number> = {};
  (b.data ?? []).forEach((r) => {
    balances[`${r.product_id}|${r.site_id}`] = Number(r.quantity);
  });

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return { products, sites: (s.data ?? []) as FormSite[], balances, today };
}