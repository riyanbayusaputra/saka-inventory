"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export type TrxInput = {
  type: "IN" | "OUT" | "TRANSFER";
  date: string;
  sourceId: string | null;
  destId: string | null;
  requester: string | null;
  purpose: string | null;
  notes: string | null;
  items: { product_id: string; quantity: number; unit_price: number; serials?: string[] }[];
};

export async function submitTransaction(
  input: TrxInput
): Promise<{ error?: string; number?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") {
    return { error: "Anda tidak punya izin membuat transaksi" };
  }

  const { type, sourceId, destId } = input;
  if ((type === "OUT" || type === "TRANSFER") && !sourceId) return { error: "Pilih site asal" };
  if ((type === "IN" || type === "TRANSFER") && !destId) return { error: "Pilih site tujuan" };
  if ((type === "TRANSFER" || type === "OUT") && destId && sourceId === destId) {
    return { error: "Site tujuan tidak boleh sama dengan site asal" };
  }
  if (!input.items.length) return { error: "Tambahkan minimal satu barang" };

  // untuk barang ber-SN, qty selalu mengikuti jumlah SN
  const items = input.items.map((i) => {
    const serials = (i.serials ?? []).map((s) => s.replace(/\s+/g, "").toUpperCase()).filter(Boolean);
    return serials.length
      ? { ...i, serials, quantity: serials.length }
      : { product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price };
  });
  if (items.some((i) => !(i.quantity > 0))) return { error: "Qty harus lebih dari 0" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stock_transaction", {
    p_type: type,
    p_date: input.date,
    p_source: type === "IN" ? null : sourceId,
    // Stock Out: tujuan hanya catatan lokasi pemakaian (stok tujuan tidak berubah)
    p_destination: type === "OUT" ? destId || null : destId,
    p_ref_type: null,
    p_ref_id: null,
    p_requester: input.requester,
    p_purpose: input.purpose,
    p_notes: input.notes,
    p_items: items,
  });

  if (error) return { error: error.message };

  const { data: trx } = await supabase
    .from("stock_transactions")
    .select("transaction_number")
    .eq("id", data)
    .single();

  revalidatePath("/", "layout");
  return { number: trx?.transaction_number };
}

export async function deleteTransaction(id: string, reason: string): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (profile?.role !== "ADMIN") return { error: "Hanya Admin yang dapat menghapus transaksi" };
  if (!reason.trim()) return { error: "Alasan penghapusan wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_stock_transaction", {
    p_id: id,
    p_reason: reason.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}