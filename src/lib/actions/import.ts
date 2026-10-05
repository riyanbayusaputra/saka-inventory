"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export type RowStatus = "ok" | "warn" | "skip" | "error";
export type RowResult = { line: number; status: RowStatus; label: string; message: string };
export type ImportReport = {
  results: RowResult[];
  importable: number;
  skipped: number;
  errors: number;
  committed: boolean;
  error?: string;
};
type RawRow = Record<string, unknown>;

// ---------- helper ----------
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const normName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function picker(row: RawRow) {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) m.set(keyOf(k), v);
  return (...aliases: string[]) => {
    for (const a of aliases) {
      const v = m.get(a);
      if (v !== undefined && String(v).trim() !== "") return v;
    }
    return undefined;
  };
}

// null = kosong, NaN = tidak valid
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? "").trim();
  if (s === "") return null;
  s = s.replace(/rp/gi, "").replace(/\s/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const str = (v: unknown) => (v === undefined ? "" : String(v).trim());
const isEmptyRow = (r: RawRow) => Object.values(r).every((v) => String(v ?? "").trim() === "");

function parseCondition(v: unknown): "NEW" | "OLD" | "RETURN" {
  const s = str(v).toUpperCase();
  if (s.includes("RETURN")) return "RETURN";
  if (s.includes("OLD")) return "OLD";
  return "NEW";
}

function buildReport(results: RowResult[], committed: boolean, error?: string): ImportReport {
  return {
    results,
    importable: results.filter((r) => r.status === "ok" || r.status === "warn").length,
    skipped: results.filter((r) => r.status === "skip").length,
    errors: results.filter((r) => r.status === "error").length,
    committed,
    error,
  };
}

async function guard(rows: RawRow[]): Promise<string | null> {
  const profile = await getProfile();
  if (profile?.role !== "ADMIN") return "Hanya Admin yang dapat melakukan import";
  if (!Array.isArray(rows) || rows.length === 0) return "File kosong atau tidak terbaca";
  if (rows.length > 2000) return "Maksimal 2000 baris per import";
  return null;
}

// =====================================================================
// 1. IMPORT MASTER BARANG
// =====================================================================
export async function importProducts(rows: RawRow[], commit: boolean): Promise<ImportReport> {
  const bad = await guard(rows);
  if (bad) return buildReport([], false, bad);

  const supabase = await createClient();
  const [cats, units, sups, prods] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("units").select("id, name"),
    supabase.from("suppliers").select("id, name"),
    supabase.from("products").select("name"),
  ]);

  const catMap = new Map((cats.data ?? []).map((c) => [normName(c.name), c.id as string]));
  const unitMap = new Map((units.data ?? []).map((c) => [normName(c.name), c.id as string]));
  const supMap = new Map((sups.data ?? []).map((c) => [normName(c.name), c.id as string]));
  const existing = new Set((prods.data ?? []).map((p) => normName(p.name)));
  const seen = new Set<string>();

  type Entry = {
    name: string; category: string | null; unit: string | null; supplierId: string | null;
    condition: string; min: number; price: number;
    brand: string | null; spec: string | null; desc: string | null;
  };
  const entries: Entry[] = [];
  const results: RowResult[] = [];
  const newCats = new Map<string, string>();
  const newUnits = new Map<string, string>();

  rows.forEach((raw, i) => {
    if (isEmptyRow(raw)) return;
    const line = i + 2;
    const p = picker(raw);

    const name = str(p("namabarang", "nama", "barang", "name"));
    if (!name) {
      results.push({ line, status: "error", label: "(tanpa nama)", message: "Nama barang kosong" });
      return;
    }
    const nn = normName(name);
    if (seen.has(nn)) {
      results.push({ line, status: "skip", label: name, message: "Duplikat di dalam file" });
      return;
    }
    seen.add(nn);
    if (existing.has(nn)) {
      results.push({ line, status: "skip", label: name, message: "Sudah ada di master barang" });
      return;
    }

    const min = num(p("minimumstok", "minstok", "minimumstock", "minimum"));
    const price = num(p("hargabeli", "harga", "price", "defaultprice"));
    if (Number.isNaN(min) || Number.isNaN(price)) {
      results.push({ line, status: "error", label: name, message: "Minimum stok / harga bukan angka" });
      return;
    }

    const warnings: string[] = [];
    const category = str(p("kategori", "category")) || null;
    const unit = str(p("satuan", "unit")) || null;
    const supplier = str(p("supplier", "pemasok"));

    if (category && !catMap.has(normName(category))) {
      newCats.set(normName(category), category);
      warnings.push(`kategori baru "${category}"`);
    }
    if (unit && !unitMap.has(normName(unit))) {
      newUnits.set(normName(unit), unit);
      warnings.push(`satuan baru "${unit}"`);
    }
    let supplierId: string | null = null;
    if (supplier) {
      supplierId = supMap.get(normName(supplier)) ?? null;
      if (!supplierId) warnings.push(`supplier "${supplier}" tidak ditemukan (dikosongkan)`);
    }

    entries.push({
      name, category, unit, supplierId,
      condition: parseCondition(p("kondisi", "condition", "status")),
      min: min ?? 0,
      price: price ?? 0,
      brand: str(p("merk", "brand")) || null,
      spec: str(p("spesifikasi", "specification")) || null,
      desc: str(p("keterangan", "deskripsi", "description")) || null,
    });
    results.push({
      line, status: warnings.length ? "warn" : "ok", label: name,
      message: warnings.length ? `Akan dibuat: ${warnings.join(", ")}` : "Siap diimport",
    });
  });

  if (!commit) return buildReport(results, false);
  if (entries.length === 0) return buildReport(results, false, "Tidak ada baris yang bisa diimport");

  // buat kategori & satuan baru
  if (newCats.size) {
    const { data, error } = await supabase
      .from("categories").insert([...newCats.values()].map((name) => ({ name }))).select("id, name");
    if (error) return buildReport(results, false, `Gagal membuat kategori: ${error.message}`);
    data?.forEach((c) => catMap.set(normName(c.name), c.id));
  }
  if (newUnits.size) {
    const { data, error } = await supabase
      .from("units").insert([...newUnits.values()].map((name) => ({ name }))).select("id, name");
    if (error) return buildReport(results, false, `Gagal membuat satuan: ${error.message}`);
    data?.forEach((c) => unitMap.set(normName(c.name), c.id));
  }

  const payload = entries.map((e) => ({
    name: e.name,
    category_id: e.category ? catMap.get(normName(e.category)) ?? null : null,
    unit_id: e.unit ? unitMap.get(normName(e.unit)) ?? null : null,
    supplier_id: e.supplierId,
    condition: e.condition,
    minimum_stock: e.min,
    default_price: e.price,
    brand: e.brand,
    specification: e.spec,
    description: e.desc,
  }));

  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await supabase.from("products").insert(payload.slice(i, i + 200));
    if (error) return buildReport(results, false, `Gagal menyimpan barang: ${error.message}`);
  }

  revalidatePath("/", "layout");
  return buildReport(results, true);
}

// =====================================================================
// 2. IMPORT SALDO AWAL
// =====================================================================
export async function importOpeningBalance(rows: RawRow[], commit: boolean): Promise<ImportReport> {
  const bad = await guard(rows);
  if (bad) return buildReport([], false, bad);

  const supabase = await createClient();
  const [prods, sites, bals] = await Promise.all([
    supabase.from("products").select("id, code, name, default_price"),
    supabase.from("sites").select("id, code, name"),
    supabase.from("stock_balances").select("product_id, site_id").gt("quantity", 0),
  ]);

  const byCode = new Map((prods.data ?? []).map((p) => [p.code.toUpperCase(), p]));
  const byName = new Map((prods.data ?? []).map((p) => [normName(p.name), p]));
  const siteMap = new Map<string, { id: string; name: string }>();
  (sites.data ?? []).forEach((s) => {
    siteMap.set(normName(s.name), s);
    siteMap.set(normName(s.code), s);
  });
  const hasStock = new Set((bals.data ?? []).map((b) => `${b.product_id}|${b.site_id}`));
  const seen = new Set<string>();

  type Item = { siteId: string; siteName: string; productId: string; qty: number; price: number };
  const items: Item[] = [];
  const results: RowResult[] = [];

  rows.forEach((raw, i) => {
    if (isEmptyRow(raw)) return;
    const line = i + 2;
    const p = picker(raw);

    const codeVal = str(p("kodebarang", "kode", "code")).toUpperCase();
    const nameVal = str(p("namabarang", "nama", "barang", "name"));
    const label = nameVal || codeVal || "(kosong)";

    const product = byCode.get(codeVal) ?? (nameVal ? byName.get(normName(nameVal)) : undefined);
    if (!product) {
      results.push({ line, status: "error", label, message: "Barang tidak ditemukan di master (cek ejaan nama)" });
      return;
    }

    const siteVal = str(p("site", "lokasi", "namasite", "kodesite"));
    const site = siteMap.get(normName(siteVal));
    if (!site) {
      results.push({ line, status: "error", label, message: `Site "${siteVal}" tidak ditemukan` });
      return;
    }

    const qty = num(p("qty", "stokakhir", "stokawal", "stok", "jumlah", "saldo"));
    if (qty === null || Number.isNaN(qty)) {
      results.push({ line, status: "error", label, message: "Qty kosong atau bukan angka" });
      return;
    }
    if (qty < 0) {
      results.push({
        line, status: "error", label,
        message: "Qty negatif. Isi 0 lalu selesaikan selisihnya lewat Stock Opname",
      });
      return;
    }
    if (qty === 0) {
      results.push({ line, status: "skip", label, message: "Qty 0, tidak perlu dicatat" });
      return;
    }

    const price = num(p("harga", "hargabeli", "price"));
    if (Number.isNaN(price)) {
      results.push({ line, status: "error", label, message: "Harga bukan angka" });
      return;
    }

    const key = `${product.id}|${site.id}`;
    if (seen.has(key)) {
      results.push({ line, status: "skip", label, message: "Duplikat barang + site di dalam file" });
      return;
    }
    seen.add(key);
    if (hasStock.has(key)) {
      results.push({ line, status: "skip", label, message: `Sudah ada stok di ${site.name}` });
      return;
    }

    items.push({
      siteId: site.id, siteName: site.name, productId: product.id, qty,
      price: price ?? Number(product.default_price ?? 0),
    });
    results.push({ line, status: "ok", label, message: `${qty} → ${site.name}` });
  });

  if (!commit) return buildReport(results, false);
  if (items.length === 0) return buildReport(results, false, "Tidak ada baris yang bisa diimport");

  const bySite = new Map<string, Item[]>();
  items.forEach((it) => bySite.set(it.siteId, [...(bySite.get(it.siteId) ?? []), it]));

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  for (const [siteId, list] of bySite) {
    const { error } = await supabase.rpc("create_stock_transaction", {
      p_type: "IN",
      p_date: today,
      p_source: null,
      p_destination: siteId,
      p_ref_type: "SALDO_AWAL",
      p_ref_id: null,
      p_requester: null,
      p_purpose: "Saldo awal",
      p_notes: "Import saldo awal dari Excel",
      p_items: list.map((it) => ({
        product_id: it.productId, quantity: it.qty, unit_price: it.price,
      })),
    });
    if (error) {
      return buildReport(results, false, `Gagal di site ${list[0].siteName}: ${error.message}`);
    }
  }

  revalidatePath("/", "layout");
  return buildReport(results, true);
}