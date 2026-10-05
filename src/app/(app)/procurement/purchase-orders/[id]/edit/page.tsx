import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PoForm, type PoProduct } from "@/components/procurement/po-form";

export default async function EditPoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;
  const supabase = await createClient();

  const [po, p, s, st] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, po_date, status, supplier_id, site_id, area, route, principal, notes, purchase_order_items(product_id, section, specification, quantity, unit_price, discount, line_no)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("products").select("id, code, name, default_price, specification").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!po.data) notFound();
  if (po.data.status !== "DRAFT") redirect(`/procurement/purchase-orders/${id}`);

  const items = [...po.data.purchase_order_items]
    .sort((a, b) => a.line_no - b.line_no)
    .map((i) => ({
      product_id: i.product_id,
      section: i.section,
      specification: i.specification,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      discount: Number(i.discount),
    }));

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <PoForm
      products={(p.data ?? []) as PoProduct[]}
      suppliers={s.data ?? []}
      sites={st.data ?? []}
      today={today}
      initial={{
        id: po.data.id,
        po_date: po.data.po_date,
        supplier_id: po.data.supplier_id,
        site_id: po.data.site_id,
        area: po.data.area,
        route: po.data.route,
        principal: po.data.principal,
        notes: po.data.notes,
        items,
      }}
    />
  );
}