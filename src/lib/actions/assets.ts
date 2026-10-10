"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export type AssetInput = {
  acquired_date: string | null;
  asset_type: string;
  name: string;
  model_serial: string | null;
  qty: number;
  price: number;
  installment: number;
  description: string | null;
  location: string | null;
};

type Res = { error?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function text(v: string | null | undefined, max: number) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

function normalize(i: AssetInput): { value?: AssetInput; error?: string } {
  const asset_type = text(i.asset_type, 100)?.toUpperCase();
  const name = text(i.name, 200);
  if (!asset_type) return { error: "Jenis wajib diisi" };
  if (!name) return { error: "Nama/merk wajib diisi" };

  const date = i.acquired_date ? String(i.acquired_date).trim() : null;
  if (date && (!ISO.test(date) || Number.isNaN(Date.parse(date)))) return { error: "Tanggal tidak valid" };

  const qty = Number(i.qty);
  if (!Number.isInteger(qty) || qty < 0 || qty > 1_000_000) {
    return { error: "Qty harus bilangan bulat 0 atau lebih" };
  }
  const price = Number(i.price);
  const installment = Number(i.installment);
  if (!Number.isFinite(price) || price < 0 || price > 1e13) return { error: "Harga tidak valid" };
  if (!Number.isFinite(installment) || installment < 0 || installment > 1e13) return { error: "Angsuran tidak valid" };

  return {
    value: {
      acquired_date: date,
      asset_type,
      name,
      model_serial: text(i.model_serial, 200),
      qty,
      price,
      installment,
      description: text(i.description, 200),
      location: text(i.location, 150),
    },
  };
}

async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === "ADMIN";
}

export async function saveAsset(id: string | null, input: AssetInput): Promise<Res> {
  if (!(await isAdmin())) return { error: "Hanya Admin yang dapat mengubah data aset" };
  const n = normalize(input);
  if (!n.value) return { error: n.error };

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("assets").update(n.value).eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Perubahan ditolak atau data tidak ditemukan" };
  } else {
    const { error } = await supabase.from("assets").insert(n.value);
    if (error) return { error: error.message };
  }

  revalidatePath("/assets");
  return {};
}

export async function toggleAsset(id: string, active: boolean): Promise<Res> {
  if (!(await isAdmin())) return { error: "Hanya Admin yang dapat mengubah data aset" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("assets").update({ is_active: active }).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Perubahan ditolak atau data tidak ditemukan" };

  revalidatePath("/assets");
  return {};
}

export async function deleteAsset(id: string): Promise<Res> {
  if (!(await isAdmin())) return { error: "Hanya Admin yang dapat menghapus aset" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("assets").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Penghapusan ditolak atau data tidak ditemukan" };

  revalidatePath("/assets");
  return {};
}

type ImportResult = Res & { inserted?: number; duplicates?: number; invalid?: number };

export async function importAssets(rows: AssetInput[]): Promise<ImportResult> {
  if (!(await isAdmin())) return { error: "Hanya Admin yang dapat melakukan import" };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Tidak ada data untuk diimport" };
  if (rows.length > 1000) return { error: "Maksimal 1000 baris per import" };

  const valid: AssetInput[] = [];
  let invalid = 0;
  for (const r of rows) {
    const n = normalize(r);
    if (n.value) valid.push(n.value);
    else invalid++;
  }
  if (!valid.length) return { error: "Tidak ada baris yang valid", invalid };

  const supabase = await createClient();
  const key = (a: { asset_type: string; name: string; model_serial: string | null; acquired_date: string | null }) =>
    [a.asset_type, a.name, a.model_serial ?? "", a.acquired_date ?? ""].join("|").toLowerCase();

  // aset yang sama (jenis, nama, seri, tanggal) dilewati supaya import bisa diulang tanpa dobel
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("assets")
      .select("asset_type, name, model_serial, acquired_date")
      .order("id")
      .range(from, from + 999);
    if (error) return { error: error.message };
    (data ?? []).forEach((d) => existing.add(key(d)));
    if (!data || data.length < 1000) break;
  }

  const fresh = valid.filter((v) => !existing.has(key(v)));
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await supabase.from("assets").insert(fresh.slice(i, i + 200));
    if (error) return { error: `Gagal menyimpan: ${error.message}` };
  }

  revalidatePath("/assets");
  return { inserted: fresh.length, duplicates: valid.length - fresh.length, invalid };
}