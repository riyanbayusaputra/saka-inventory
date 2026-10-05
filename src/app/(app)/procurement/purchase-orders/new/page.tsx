import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PoForm, type PoProduct } from "@/components/procurement/po-form";

export default async function NewPoPage() {
  await requireRole(["ADMIN", "STAFF"]);
  const supabase = await createClient();

  const [p, s, st] = await Promise.all([
    supabase.from("products").select("id, code, name, default_price, specification").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
  ]);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <PoForm
      products={(p.data ?? []) as PoProduct[]}
      suppliers={s.data ?? []}
      sites={st.data ?? []}
      today={today}
    />
  );
}