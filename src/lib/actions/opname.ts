"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

type Res = { error?: string };

export type OpnameItemInput = {
  product_id: string;
  physical_stock: number;
  reason: string | null;
};

export async function saveOpname(
  id: string | null,
  header: { opname_date: string; site_id: string; notes: string | null },
  items: OpnameItemInput[]
): Promise<Res & { id?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin membuat stock opname" };
  if (!header.site_id) return { error: "Pilih site" };
  if (!items.length) return { error: "Isi stok fisik minimal pada satu barang" };

  const seen = new Set<string>();
  for (const [i, it] of items.entries()) {
    if (!(it.physical_stock >= 0)) return { error: `Baris ${i + 1}: stok fisik tidak boleh negatif` };
    if (seen.has(it.product_id)) return { error: `Baris ${i + 1}: barang yang sama sudah ada` };
    seen.add(it.product_id);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_stock_opname", {
    p_id: id,
    p_header: header,
    p_items: items,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory", "layout");
  return { id: data as string };
}

export async function submitOpname(id: string): Promise<Res> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("stock_opname_items")
    .select("id", { count: "exact", head: true })
    .eq("opname_id", id);
  if (!count) return { error: "Opname belum memiliki barang" };

  const { data, error } = await supabase
    .from("stock_opnames")
    .update({ status: "DIAJUKAN" })
    .eq("id", id)
    .eq("status", "DRAFT")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Opname tidak ditemukan atau bukan Draft" };

  revalidatePath("/inventory", "layout");
  return {};
}

export async function approveOpname(id: string, note: string | null): Promise<Res> {
  const profile = await getProfile();
  if (profile?.role !== "ADMIN") return { error: "Hanya Admin yang dapat menyetujui" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_stock_opname", { p_opname: id, p_note: note });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

export async function rejectOpname(id: string, note: string): Promise<Res> {
  const profile = await getProfile();
  if (profile?.role !== "ADMIN") return { error: "Hanya Admin yang dapat menolak" };
  if (!note.trim()) return { error: "Alasan penolakan wajib diisi" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_opnames")
    .update({ status: "DITOLAK", review_note: note.trim(), approved_by: profile.id })
    .eq("id", id)
    .in("status", ["DRAFT", "DIAJUKAN"])
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Opname sudah diproses atau tidak ditemukan" };

  revalidatePath("/inventory", "layout");
  return {};
}

export async function deleteOpname(id: string): Promise<Res> {
  const profile = await getProfile();
  if (!profile || profile.role === "VIEWER") return { error: "Anda tidak punya izin" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_opnames")
    .delete()
    .eq("id", id)
    .eq("status", "DRAFT")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Hanya Draft milik Anda yang dapat dihapus" };

  revalidatePath("/inventory", "layout");
  return {};
}