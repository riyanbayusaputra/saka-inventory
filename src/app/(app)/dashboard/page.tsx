import Link from "next/link";
import {
  Package, Boxes, AlertTriangle, PackageX, Wallet, ShoppingCart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { rupiah, number } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { MovementChart, type MonthPoint } from "@/components/dashboard/movement-chart";

type Stats = {
  total_products: number;
  total_stock: number;
  low_stock: number;
  out_of_stock: number;
  inventory_value: number;
  procurement_month: number;
};

type LowRow = {
  product_id: string; code: string; name: string;
  minimum_stock: number; total_quantity: number;
  status: "LOW_STOCK" | "OUT_OF_STOCK";
};

type TopRow = { product_id: string; name: string; total_out: number };

type Recent = {
  id: string;
  transaction_number: string;
  transaction_type: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT" | "RETURN";
  transaction_date: string;
  stock_transaction_items: { quantity: number; products: { name: string } | null }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TYPE_LABEL = {
  IN: "Stock In", OUT: "Stock Out", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment", RETURN: "Retur",
} as const;

function lastMonths(n: number) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift({ key: `${y}-${String(m).padStart(2, "0")}-01`, label: MONTHS[m - 1] });
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return out;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const months = lastMonths(6);

  const [statsRes, moveRes, topRes, lowRes, recentRes] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase.from("v_monthly_movement").select("month, transaction_type, total_qty").gte("month", months[0].key),
    supabase.from("v_top_used").select("product_id, name, total_out").order("total_out", { ascending: false }).limit(5),
    supabase.from("v_product_stock_total")
      .select("product_id, code, name, minimum_stock, total_quantity, status")
      .in("status", ["LOW_STOCK", "OUT_OF_STOCK"])
      .order("total_quantity")
      .limit(10),
    supabase.from("stock_transactions")
      .select("id, transaction_number, transaction_type, transaction_date, stock_transaction_items(quantity, products(name))")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = statsRes.data as Stats | null;
  const top = (topRes.data ?? []) as TopRow[];
  const low = (lowRes.data ?? []) as LowRow[];
  const recent = (recentRes.data ?? []) as unknown as Recent[];

  const chart: MonthPoint[] = months.map((mo) => {
    const rows = (moveRes.data ?? []).filter((r) => String(r.month).slice(0, 10) === mo.key);
    const sum = (t: string) =>
      rows.filter((r) => r.transaction_type === t).reduce((s, r) => s + Number(r.total_qty), 0);
    return { label: mo.label, in: sum("IN"), out: sum("OUT") };
  });

  const maxTop = Math.max(1, ...top.map((t) => Number(t.total_out)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Selamat datang, {profile?.full_name}. Ringkasan inventory saat ini.
        </p>
      </div>

      {!stats && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Statistik belum bisa dimuat{statsRes.error ? `: ${statsRes.error.message}` : ""}. Pastikan SQL dashboard
          sudah dijalankan di Supabase.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Barang" value={number(stats?.total_products ?? 0)} icon={Package} />
        <StatCard label="Total Stok" value={number(Number(stats?.total_stock ?? 0))} icon={Boxes} />
        <StatCard label="Stok Menipis" value={number(stats?.low_stock ?? 0)} icon={AlertTriangle} tone="warning" />
        <StatCard label="Stok Habis" value={number(stats?.out_of_stock ?? 0)} icon={PackageX} tone="danger" />
        <StatCard label="Total Nilai Inventory" value={rupiah(Number(stats?.inventory_value ?? 0))} icon={Wallet} />
        <StatCard label="Pengadaan Bulan Ini" value={rupiah(Number(stats?.procurement_month ?? 0))} icon={ShoppingCart} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Stock In / Stock Out (6 bulan)</CardTitle></CardHeader>
          <CardContent><MovementChart data={chart} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Paling Banyak Digunakan</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {top.length === 0 && <p className="text-sm text-muted-foreground">Belum ada Stock Out dalam 90 hari terakhir.</p>}
            {top.map((t) => (
              <div key={t.product_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <Link href={`/inventory/products/${t.product_id}`} className="truncate hover:underline">{t.name}</Link>
                  <b>{number(Number(t.total_out))}</b>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${(Number(t.total_out) / maxTop) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Perlu Pengadaan Ulang</CardTitle>
            <Link href="/inventory/stock" className="text-sm text-muted-foreground hover:underline">Lihat stok</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {low.length === 0 && <p className="text-sm text-muted-foreground">Semua stok aman.</p>}
            {low.map((r) => (
              <div key={r.product_id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/inventory/products/${r.product_id}`} className="block truncate font-medium hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Stok {number(Number(r.total_quantity))} · Minimum {number(Number(r.minimum_stock))}
                  </p>
                </div>
                <Badge variant={r.status === "OUT_OF_STOCK" ? "destructive" : "outline"}>
                  {r.status === "OUT_OF_STOCK" ? "Habis" : "Menipis"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Transaksi Terbaru</CardTitle>
            <Link href="/inventory/transactions" className="text-sm text-muted-foreground hover:underline">Lihat semua</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>}
            {recent.map((t) => {
              const items = t.stock_transaction_items;
              return (
                <div key={t.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{t.transaction_number}</p>
                    <p className="truncate text-muted-foreground">
                      {items[0]?.products?.name} × {Number(items[0]?.quantity ?? 0)}
                      {items.length > 1 && ` +${items.length - 1} lainnya`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={t.transaction_type === "OUT" ? "destructive" : "secondary"}>
                      {TYPE_LABEL[t.transaction_type]}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{t.transaction_date}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}