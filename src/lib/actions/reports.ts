"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { STATUS_LABEL, type PoStatus } from "@/lib/po";
import { OPNAME_LABEL, type OpnameStatus } from "@/lib/opname";
import type { Col, Filters, ReportData, ReportType, Row } from "@/lib/reports";

type Client = Awaited<ReturnType<typeof createClient>>;
type Resp = { data: unknown[] | null; error: { message: string } | null };

const MAX_ROWS = 10000;
const PAGE = 1000;

// Supabase membatasi 1000 baris per query, jadi diambil bertahap
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<Resp>) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) return { rows, truncated: false, error: error.message };
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

const n = (v: unknown) => Number(v ?? 0);

function filterQ(rows: Row[], q: string | undefined, keys: string[]) {
  const s = (q ?? "").trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
}

const byDateDesc = (a: Row, b: Row) =>
  String(b.date ?? "").localeCompare(String(a.date ?? "")) ||
  String(b.no ?? "").localeCompare(String(a.no ?? ""));

async function poNumbers(supabase: Client, ids: string[]) {
  const map = new Map<string, string>();
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 100) {
    const { data } = await supabase.from("purchase_orders").select("id, po_number").in("id", uniq.slice(i, i + 100));
    (data ?? []).forEach((p: { id: string; po_number: string }) => map.set(p.id, p.po_number));
  }
  return map;
}

const result = (columns: Col[], rows: Row[], truncated: boolean, error?: string): ReportData => ({
  columns, rows, truncated, error,
});

// ---------------------------------------------------------------- stok
async function stockReport(supabase: Client, f: Filters) {
  const columns: Col[] = [
    { key: "code", label: "Kode" },
    { key: "name", label: "Nama Barang" },
    { key: "category", label: "Kategori" },
    { key: "site", label: "Site" },
    { key: "qty", label: "Stok", type: "number" },
    { key: "min", label: "Minimum", type: "number" },
    { key: "status", label: "Status" },
  ];
  let catName: string | null = null;
  if (f.categoryId) {
    const { data } = await supabase.from("categories").select("name").eq("id", f.categoryId).maybeSingle();
    catName = data?.name ?? null;
  }
  const label = { SAFE: "Aman", LOW_STOCK: "Stok Menipis", OUT_OF_STOCK: "Habis" } as Record<string, string>;

  type R = { code: string; product_name: string; category: string | null; site_name: string; quantity: number; minimum_stock: number; status: string };
  const res = await fetchAll<R>((a, b) => {
    let q = supabase.from("v_stock_status").select("code, product_name, category, site_name, quantity, minimum_stock, status");
    if (f.siteId) q = q.eq("site_id", f.siteId);
    if (catName) q = q.eq("category", catName);
    if (f.status) q = q.eq("status", f.status);
    return q.order("product_name").order("site_name").range(a, b);
  });

  const rows: Row[] = res.rows.map((r) => ({
    code: r.code, name: r.product_name, category: r.category, site: r.site_name,
    qty: n(r.quantity), min: n(r.minimum_stock), status: label[r.status] ?? r.status,
  }));
  return result(columns, filterQ(rows, f.q, ["code", "name"]), res.truncated, res.error);
}

// ------------------------------------------------------ stock in / out
type TrxItem = {
  quantity: number; unit_price: number; subtotal: number;
  products: { code: string; name: string; units: { name: string } | null } | null;
  stock_transactions: {
    transaction_number: string; transaction_date: string;
    reference_type: string | null; reference_id: string | null;
    requester: string | null; purpose: string | null;
    source: { name: string } | null; dest: { name: string } | null;
    profiles: { full_name: string | null } | null;
  } | null;
};

async function stockInOutReport(supabase: Client, f: Filters, isIn: boolean) {
  const res = await fetchAll<TrxItem>((a, b) => {
    let q = supabase
      .from("stock_transaction_items")
      .select(`
        quantity, unit_price, subtotal,
        products!inner(code, name, category_id, supplier_id, units(name)),
        stock_transactions!inner(
          transaction_number, transaction_date, transaction_type, reference_type, reference_id,
          requester, purpose,
          source:sites!stock_transactions_source_site_id_fkey(name),
          dest:sites!stock_transactions_destination_site_id_fkey(name),
          profiles(full_name)
        )
      `)
      .eq("stock_transactions.transaction_type", isIn ? "IN" : "OUT");
    if (f.from) q = q.gte("stock_transactions.transaction_date", f.from);
    if (f.to) q = q.lte("stock_transactions.transaction_date", f.to);
    if (f.siteId) q = q.eq(isIn ? "stock_transactions.destination_site_id" : "stock_transactions.source_site_id", f.siteId);
    if (f.categoryId) q = q.eq("products.category_id", f.categoryId);
    if (f.supplierId && isIn) q = q.eq("products.supplier_id", f.supplierId);
    return q.order("id").range(a, b);
  });

  const poIds = res.rows
    .filter((r) => r.stock_transactions?.reference_type === "PO" && r.stock_transactions.reference_id)
    .map((r) => r.stock_transactions!.reference_id as string);
  const poMap = await poNumbers(supabase, poIds);

  const refOf = (t: NonNullable<TrxItem["stock_transactions"]>) => {
    if (t.reference_type === "PO") return poMap.get(t.reference_id ?? "") ?? "PO";
    if (t.reference_type === "SALDO_AWAL") return "Saldo awal";
    return "-";
  };

  const rows: Row[] = res.rows.map((r) => {
    const t = r.stock_transactions!;
    const base: Row = {
      date: t.transaction_date, no: t.transaction_number,
      code: r.products?.code ?? null, name: r.products?.name ?? null,
      unit: r.products?.units?.name ?? null, qty: n(r.quantity),
      by: t.profiles?.full_name ?? null,
    };
    return isIn
      ? { ...base, site: t.dest?.name ?? null, price: n(r.unit_price), total: n(r.subtotal), ref: refOf(t) }
      : { ...base, site: t.source?.name ?? null, requester: t.requester, purpose: t.purpose };
  });

  const columns: Col[] = isIn
    ? [
        { key: "date", label: "Tanggal" }, { key: "no", label: "No. Transaksi" },
        { key: "code", label: "Kode" }, { key: "name", label: "Barang" }, { key: "unit", label: "Satuan" },
        { key: "site", label: "Site Tujuan" }, { key: "qty", label: "Qty", type: "number" },
        { key: "price", label: "Harga Satuan", type: "currency" }, { key: "total", label: "Subtotal", type: "currency" },
        { key: "ref", label: "Referensi" }, { key: "by", label: "Oleh" },
      ]
    : [
        { key: "date", label: "Tanggal" }, { key: "no", label: "No. Transaksi" },
        { key: "code", label: "Kode" }, { key: "name", label: "Barang" }, { key: "unit", label: "Satuan" },
        { key: "site", label: "Site Asal" }, { key: "qty", label: "Qty", type: "number" },
        { key: "requester", label: "Pemakai" }, { key: "purpose", label: "Keperluan" }, { key: "by", label: "Oleh" },
      ];

  return result(columns, filterQ(rows, f.q, ["code", "name"]).sort(byDateDesc), res.truncated, res.error);
}

// -------------------------------------------------------------- mutasi
async function movementReport(supabase: Client, f: Filters) {
  type R = {
    change_qty: number; balance_after: number;
    products: { code: string; name: string } | null;
    sites: { name: string } | null;
    stock_transactions: { transaction_number: string; transaction_date: string; transaction_type: string } | null;
  };
  const res = await fetchAll<R>((a, b) => {
    let q = supabase
      .from("stock_movements")
      .select(`
        change_qty, balance_after,
        products!inner(code, name, category_id),
        sites(name),
        stock_transactions!inner(transaction_number, transaction_date, transaction_type)
      `);
    if (f.from) q = q.gte("stock_transactions.transaction_date", f.from);
    if (f.to) q = q.lte("stock_transactions.transaction_date", f.to);
    if (f.trxType) q = q.eq("stock_transactions.transaction_type", f.trxType);
    if (f.siteId) q = q.eq("site_id", f.siteId);
    if (f.categoryId) q = q.eq("products.category_id", f.categoryId);
    return q.order("created_at", { ascending: false }).order("id").range(a, b);
  });

  const typeLabel: Record<string, string> = {
    IN: "Stock In", OUT: "Stock Out", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment", RETURN: "Retur",
  };
  const rows: Row[] = res.rows.map((r) => ({
    date: r.stock_transactions?.transaction_date ?? null,
    no: r.stock_transactions?.transaction_number ?? null,
    type: typeLabel[r.stock_transactions?.transaction_type ?? ""] ?? null,
    code: r.products?.code ?? null, name: r.products?.name ?? null,
    site: r.sites?.name ?? null, change: n(r.change_qty), balance: n(r.balance_after),
  }));

  const columns: Col[] = [
    { key: "date", label: "Tanggal" }, { key: "no", label: "No. Transaksi" }, { key: "type", label: "Tipe" },
    { key: "code", label: "Kode" }, { key: "name", label: "Barang" }, { key: "site", label: "Site" },
    { key: "change", label: "Perubahan", type: "number" }, { key: "balance", label: "Saldo Site", type: "number" },
  ];
  return result(columns, filterQ(rows, f.q, ["code", "name"]), res.truncated, res.error);
}

// ----------------------------------------------------------- pengadaan
async function procurementReport(supabase: Client, f: Filters) {
  type R = {
    section: string | null; quantity: number; received_qty: number;
    unit_price: number; discount: number; subtotal: number;
    products: { code: string; name: string } | null;
    purchase_orders: {
      po_number: string; po_date: string; status: PoStatus;
      suppliers: { name: string } | null;
    } | null;
  };
  const res = await fetchAll<R>((a, b) => {
    let q = supabase
      .from("purchase_order_items")
      .select(`
        section, quantity, received_qty, unit_price, discount, subtotal,
        products!inner(code, name, category_id),
        purchase_orders!inner(po_number, po_date, status, supplier_id, site_id, suppliers(name))
      `);
    if (f.from) q = q.gte("purchase_orders.po_date", f.from);
    if (f.to) q = q.lte("purchase_orders.po_date", f.to);
    if (f.siteId) q = q.eq("purchase_orders.site_id", f.siteId);
    if (f.supplierId) q = q.eq("purchase_orders.supplier_id", f.supplierId);
    if (f.status) q = q.eq("purchase_orders.status", f.status);
    if (f.categoryId) q = q.eq("products.category_id", f.categoryId);
    return q.order("id").range(a, b);
  });

  const rows: Row[] = res.rows.map((r) => ({
    date: r.purchase_orders?.po_date ?? null,
    no: r.purchase_orders?.po_number ?? null,
    supplier: r.purchase_orders?.suppliers?.name ?? null,
    status: r.purchase_orders ? STATUS_LABEL[r.purchase_orders.status] : null,
    section: r.section, code: r.products?.code ?? null, name: r.products?.name ?? null,
    qty: n(r.quantity), received: n(r.received_qty),
    price: n(r.unit_price), discount: n(r.discount), total: n(r.subtotal),
  }));

  const columns: Col[] = [
    { key: "date", label: "Tanggal" }, { key: "no", label: "No. PO" }, { key: "supplier", label: "Supplier" },
    { key: "status", label: "Status" }, { key: "section", label: "Bagian" },
    { key: "code", label: "Kode" }, { key: "name", label: "Barang" },
    { key: "qty", label: "Qty", type: "number" }, { key: "received", label: "Diterima", type: "number" },
    { key: "price", label: "Harga", type: "currency" }, { key: "discount", label: "Diskon", type: "currency" },
    { key: "total", label: "Subtotal", type: "currency" },
  ];
  return result(columns, filterQ(rows, f.q, ["code", "name", "no"]).sort(byDateDesc), res.truncated, res.error);
}

// ------------------------------------------------------------ per site
async function perSiteReport(supabase: Client, f: Filters) {
  type R = {
    site_id: string; quantity: number;
    sites: { name: string } | null;
    products: { avg_cost: number } | null;
  };
  const res = await fetchAll<R>((a, b) => {
    let q = supabase
      .from("stock_balances")
      .select("site_id, quantity, sites!inner(name), products!inner(avg_cost, category_id, is_active)")
      .gt("quantity", 0)
      .eq("products.is_active", true);
    if (f.siteId) q = q.eq("site_id", f.siteId);
    if (f.categoryId) q = q.eq("products.category_id", f.categoryId);
    return q.order("id").range(a, b);
  });

  const agg = new Map<string, { name: string; kinds: number; qty: number; value: number }>();
  for (const r of res.rows) {
    const cur = agg.get(r.site_id) ?? { name: r.sites?.name ?? "-", kinds: 0, qty: 0, value: 0 };
    cur.kinds += 1;
    cur.qty += n(r.quantity);
    cur.value += n(r.quantity) * n(r.products?.avg_cost);
    agg.set(r.site_id, cur);
  }

  const list = [...agg.values()].sort((a, b) => a.name.localeCompare(b.name));
  const rows: Row[] = list.map((s) => ({ site: s.name, kinds: s.kinds, qty: s.qty, value: Math.round(s.value) }));
  if (rows.length > 1) {
    rows.push({
      site: "TOTAL",
      kinds: list.reduce((s, x) => s + x.kinds, 0),
      qty: list.reduce((s, x) => s + x.qty, 0),
      value: Math.round(list.reduce((s, x) => s + x.value, 0)),
    });
  }

  const columns: Col[] = [
    { key: "site", label: "Site" },
    { key: "kinds", label: "Jenis Barang", type: "number" },
    { key: "qty", label: "Total Qty", type: "number" },
    { key: "value", label: "Nilai Inventory", type: "currency" },
  ];
  return result(columns, rows, res.truncated, res.error);
}

// -------------------------------------------------------------- barang
async function productsReport(supabase: Client, f: Filters) {
  type P = {
    id: string; code: string; name: string; brand: string | null; condition: string;
    minimum_stock: number; default_price: number; avg_cost: number; is_active: boolean;
    categories: { name: string } | null; units: { name: string } | null; suppliers: { name: string } | null;
  };
  const prods = await fetchAll<P>((a, b) => {
    let q = supabase
      .from("products")
      .select("id, code, name, brand, condition, minimum_stock, default_price, avg_cost, is_active, categories(name), units(name), suppliers(name)");
    if (f.categoryId) q = q.eq("category_id", f.categoryId);
    if (f.supplierId) q = q.eq("supplier_id", f.supplierId);
    if (f.status === "ACTIVE") q = q.eq("is_active", true);
    if (f.status === "INACTIVE") q = q.eq("is_active", false);
    return q.order("name").order("id").range(a, b);
  });

  const bals = await fetchAll<{ product_id: string; quantity: number }>((a, b) =>
    supabase.from("stock_balances").select("product_id, quantity").order("id").range(a, b)
  );
  const totals = new Map<string, number>();
  bals.rows.forEach((x) => totals.set(x.product_id, (totals.get(x.product_id) ?? 0) + n(x.quantity)));

  const rows: Row[] = prods.rows.map((p) => ({
    code: p.code, name: p.name, category: p.categories?.name ?? null, unit: p.units?.name ?? null,
    supplier: p.suppliers?.name ?? null, brand: p.brand, condition: p.condition,
    min: n(p.minimum_stock), stock: totals.get(p.id) ?? 0,
    price: n(p.default_price), avg: n(p.avg_cost), active: p.is_active ? "Aktif" : "Nonaktif",
  }));

  const columns: Col[] = [
    { key: "code", label: "Kode" }, { key: "name", label: "Nama Barang" }, { key: "category", label: "Kategori" },
    { key: "unit", label: "Satuan" }, { key: "supplier", label: "Supplier" }, { key: "brand", label: "Merk" },
    { key: "condition", label: "Kondisi" }, { key: "min", label: "Min. Stok", type: "number" },
    { key: "stock", label: "Total Stok", type: "number" }, { key: "price", label: "Harga Beli", type: "currency" },
    { key: "avg", label: "Harga Rata-rata", type: "currency" }, { key: "active", label: "Status" },
  ];
  return result(
    columns, filterQ(rows, f.q, ["code", "name"]),
    prods.truncated || bals.truncated, prods.error ?? bals.error
  );
}

// -------------------------------------------------------------- opname
async function opnameReport(supabase: Client, f: Filters) {
  type R = {
    system_stock: number; physical_stock: number; difference: number; reason: string | null;
    products: { code: string; name: string } | null;
    stock_opnames: { opname_number: string; opname_date: string; status: OpnameStatus; sites: { name: string } | null } | null;
  };
  const res = await fetchAll<R>((a, b) => {
    let q = supabase
      .from("stock_opname_items")
      .select(`
        system_stock, physical_stock, difference, reason,
        products!inner(code, name, category_id),
        stock_opnames!inner(opname_number, opname_date, status, site_id, sites(name))
      `);
    if (f.from) q = q.gte("stock_opnames.opname_date", f.from);
    if (f.to) q = q.lte("stock_opnames.opname_date", f.to);
    if (f.siteId) q = q.eq("stock_opnames.site_id", f.siteId);
    if (f.status) q = q.eq("stock_opnames.status", f.status);
    if (f.categoryId) q = q.eq("products.category_id", f.categoryId);
    return q.order("id").range(a, b);
  });

  const rows: Row[] = res.rows.map((r) => ({
    date: r.stock_opnames?.opname_date ?? null,
    no: r.stock_opnames?.opname_number ?? null,
    site: r.stock_opnames?.sites?.name ?? null,
    status: r.stock_opnames ? OPNAME_LABEL[r.stock_opnames.status] : null,
    code: r.products?.code ?? null, name: r.products?.name ?? null,
    system: n(r.system_stock), physical: n(r.physical_stock), diff: n(r.difference), reason: r.reason,
  }));

  const columns: Col[] = [
    { key: "date", label: "Tanggal" }, { key: "no", label: "No. Opname" }, { key: "site", label: "Site" },
    { key: "status", label: "Status" }, { key: "code", label: "Kode" }, { key: "name", label: "Barang" },
    { key: "system", label: "Sistem", type: "number" }, { key: "physical", label: "Fisik", type: "number" },
    { key: "diff", label: "Selisih", type: "number" }, { key: "reason", label: "Alasan" },
  ];
  return result(columns, filterQ(rows, f.q, ["code", "name", "no"]).sort(byDateDesc), res.truncated, res.error);
}

// --------------------------------------------------------------- entry
export async function runReport(type: ReportType, filters: Filters): Promise<ReportData> {
  const profile = await getProfile();
  if (!profile || !profile.is_active) return result([], [], false, "Sesi berakhir, silakan login ulang");

  const supabase = await createClient();
  try {
    switch (type) {
      case "stock": return await stockReport(supabase, filters);
      case "stock-in": return await stockInOutReport(supabase, filters, true);
      case "stock-out": return await stockInOutReport(supabase, filters, false);
      case "movement": return await movementReport(supabase, filters);
      case "procurement": return await procurementReport(supabase, filters);
      case "per-site": return await perSiteReport(supabase, filters);
      case "products": return await productsReport(supabase, filters);
      case "opname": return await opnameReport(supabase, filters);
      default: return result([], [], false, "Jenis laporan tidak dikenal");
    }
  } catch (e) {
    return result([], [], false, e instanceof Error ? e.message : "Terjadi kesalahan");
  }
}