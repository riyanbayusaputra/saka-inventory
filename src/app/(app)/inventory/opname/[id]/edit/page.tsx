import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFormData } from "@/lib/form-data";
import { OpnameForm } from "@/components/inventory/opname-form";

export default async function EditOpnamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;
  const supabase = await createClient();

  const [op, data] = await Promise.all([
    supabase
      .from("stock_opnames")
      .select("id, opname_date, site_id, notes, status, stock_opname_items(product_id, physical_stock, reason)")
      .eq("id", id)
      .maybeSingle(),
    loadFormData(),
  ]);

  if (!op.data) notFound();
  if (op.data.status !== "DRAFT") redirect(`/inventory/opname/${id}`);

  return (
    <OpnameForm
      {...data}
      initial={{
        id: op.data.id,
        opname_date: op.data.opname_date,
        site_id: op.data.site_id,
        notes: op.data.notes,
        items: op.data.stock_opname_items.map((i) => ({
          product_id: i.product_id,
          physical_stock: Number(i.physical_stock),
          reason: i.reason,
        })),
      }}
    />
  );
}