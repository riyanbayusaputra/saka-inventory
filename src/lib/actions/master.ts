"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export type Values = Record<string, string | number | boolean | null>;
export type Result = { error?: string };

// Whitelist tabel & kolom yang boleh ditulis dari form
const FIELDS: Record<string, string[]> = {
  categories: ["name"],
  units: ["name"],
  suppliers: ["name", "address", "phone", "email"],
  sites: ["code", "name", "address", "pic", "phone", "is_warehouse"],
  products: [
    "name", "category_id", "unit_id", "supplier_id", "specification", "brand",
    "condition", "minimum_stock", "default_price", "description",
  ],
};

function friendlyError(code?: string, message?: string) {
  if (code === "23505") return "Data sudah ada (duplikat)";
  if (code === "23502") return "Ada kolom wajib yang belum diisi";
  if (code === "42501") return "Anda tidak punya izin untuk aksi ini";
  return message ?? "Terjadi kesalahan";
}

async function requireAdmin() {
  const profile = await getProfile();
  return profile?.role === "ADMIN";
}

export async function saveRecord(
  table: string,
  id: string | null,
  values: Values
): Promise<Result> {
  if (!(await requireAdmin())) return { error: "Hanya Admin yang dapat mengubah data" };

  const allowed = FIELDS[table];
  if (!allowed) return { error: "Tabel tidak valid" };

  const payload = Object.fromEntries(
    Object.entries(values).filter(([k]) => allowed.includes(k))
  );

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from(table).update(payload).eq("id", id)
    : await supabase.from(table).insert(payload);

  if (error) return { error: friendlyError(error.code, error.message) };

  revalidatePath("/", "layout");
  return {};
}

export async function toggleActive(
  table: string,
  id: string,
  isActive: boolean
): Promise<Result> {
  if (!(await requireAdmin())) return { error: "Hanya Admin yang dapat mengubah data" };
  if (!FIELDS[table]) return { error: "Tabel tidak valid" };

  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ is_active: isActive }).eq("id", id);
  if (error) return { error: friendlyError(error.code, error.message) };

  revalidatePath("/", "layout");
  return {};
}