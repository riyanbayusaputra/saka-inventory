"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { RECEIVABLE, TRANSITIONS, type PoStatus } from "@/lib/po";

export type PoHeader = {
  po_date: string;
  supplier_id: string | null;
  site_id: string | null;
  area: string | null;
  route: string | null;
  principal: string | null;
  notes: string | null;
};

export type PoItemInput = {
  product_id: string;
  section: string | null;
  specification: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
};

type Res = { error?: string };

export async function savePO(
  id: string | null,
  header: PoHeader,
  items: PoItemInput[]
): Promise<Res & { id?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin membuat PO" };
  if (!items.length) return { error: "Tambahkan minimal satu barang" };

  const seen = new Set<string>();
  for (const [i, it] of items.entries()) {
    const n = i + 1;
    if (!(it.quantity > 0)) return { error: `Baris ${n}: qty harus lebih dari 0` };
    if (it.unit_price < 0 || it.discount < 0) return { error: `Baris ${n}: harga/diskon tidak boleh negatif` };
    if (it.discount > it.quantity * it.unit_price) return { error: `Baris ${n}: diskon melebihi nilai barang` };
    if (seen.has(it.product_id)) return { error: `Baris ${n}: barang yang sama sudah ada di PO ini` };
    seen.add(it.product_id);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_purchase_order", {
    p_id: id,
    p_header: header,
    p_items: items,
  });
  if (error) return { error: error.message };

  revalidatePath("/procurement", "layout");
  return { id: data as string };
}

export async function changeStatus(id: string, to: PoStatus): Promise<Res> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin" };

  const supabase = await createClient();
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status, purchase_order_items(id)")
    .eq("id", id)
    .maybeSingle();
  if (!po) return { error: "PO tidak ditemukan" };

  const from = po.status as PoStatus;
  if (!TRANSITIONS[from].includes(to)) return { error: `Status ${from} tidak bisa diubah ke ${to}` };

  // Staff hanya boleh mengajukan atau membatalkan Draft
  if (profile.role !== "ADMIN" && !(from === "DRAFT" && (to === "DIAJUKAN" || to === "DIBATALKAN"))) {
    return { error: "Hanya Admin yang dapat melakukan perubahan status ini" };
  }
  if (to === "DIAJUKAN" && (po.purchase_order_items as unknown[]).length === 0) {
    return { error: "PO belum memiliki barang" };
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === "DISETUJUI") patch.approved_by = profile.id;

  const { data, error } = await supabase.from("purchase_orders").update(patch).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Perubahan ditolak (tidak ada izin)" };

  revalidatePath("/procurement", "layout");
  return {};
}

export async function receivePO(input: {
  poId: string;
  siteId: string;
  date: string;
  notes: string | null;
  items: { product_id: string; quantity: number }[];
}): Promise<Res & { number?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin menerima barang" };
  if (!input.siteId) return { error: "Pilih site tujuan penerimaan" };

  const lines = input.items.filter((i) => i.quantity > 0);
  if (!lines.length) return { error: "Isi qty yang diterima minimal pada satu barang" };

  const supabase = await createClient();
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status, purchase_order_items(product_id, quantity, received_qty, unit_price, discount)")
    .eq("id", input.poId)
    .maybeSingle();
  if (!po) return { error: "PO tidak ditemukan" };
  if (!RECEIVABLE.includes(po.status as PoStatus)) {
    return { error: "PO ini belum disetujui atau sudah ditutup, barang tidak dapat diterima" };
  }

  const byProduct = new Map(
    (po.purchase_order_items as {
      product_id: string; quantity: number; received_qty: number; unit_price: number; discount: number;
    }[]).map((i) => [i.product_id, i])
  );

  const items: { product_id: string; quantity: number; unit_price: number }[] = [];
  for (const l of lines) {
    const line = byProduct.get(l.product_id);
    if (!line) return { error: "Ada barang yang tidak terdaftar di PO ini" };
    const remaining = Number(line.quantity) - Number(line.received_qty);
    if (l.quantity > remaining) return { error: `Qty melebihi sisa PO (sisa ${remaining})` };
    // harga bersih per unit setelah diskon
    const net = Number(line.unit_price) - Number(line.discount) / Number(line.quantity);
    items.push({ product_id: l.product_id, quantity: l.quantity, unit_price: Math.round(net * 100) / 100 });
  }

  const { data: trxId, error } = await supabase.rpc("create_stock_transaction", {
    p_type: "IN",
    p_date: input.date,
    p_source: null,
    p_destination: input.siteId,
    p_ref_type: "PO",
    p_ref_id: input.poId,
    p_requester: null,
    p_purpose: "Penerimaan barang PO",
    p_notes: input.notes,
    p_items: items,
  });
  if (error) return { error: error.message };

  const { data: trx } = await supabase
    .from("stock_transactions")
    .select("transaction_number")
    .eq("id", trxId)
    .single();

  revalidatePath("/", "layout");
  return { number: trx?.transaction_number };
}