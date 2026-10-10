import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Product = {
  id: string; code: string; name: string; specification: string | null; brand: string | null;
  condition: string; minimum_stock: number; default_price: number; avg_cost: number;
  track_serial?: boolean; pon_type?: string | null;
  categories: { name: string } | null;
  units: { name: string } | null;
  suppliers: { name: string } | null;
};
type Balance = { quantity: number; sites: { name: string } | null };
type Movement = {
  id: string; change_qty: number; balance_after: number; created_at: string;
  sites: { name: string } | null;
  stock_transactions: {
    id: string; transaction_number: string; transaction_type: string; transaction_date: string;
  } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();

  const [prod, bal, mov] = await Promise.all([
    supabase.from("products")
      .select("*, categories(name), units(name), suppliers(name)")
      .eq("id", id).maybeSingle(),
    supabase.from("stock_balances").select("quantity, sites(name)").eq("product_id", id),
    supabase.from("stock_movements")
      .select("id, change_qty, balance_after, created_at, sites(name), stock_transactions(id, transaction_number, transaction_type, transaction_date)")
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!prod.data) notFound();

  const p = prod.data as unknown as Product;
  const balances = (bal.data ?? []) as unknown as Balance[];
  const movements = (mov.data ?? []) as unknown as Movement[];
  const total = balances.reduce((s, b) => s + Number(b.quantity), 0);
  const min = Number(p.minimum_stock);
  const status = total === 0 ? "Habis" : total <= min ? "Stok Menipis" : "Aman";

  return (
    <div className="space-y-4">
      <Link href="/inventory/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Barang
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-muted-foreground">
            {p.code} · {p.condition}
            {p.pon_type && <Badge variant="outline" className="ml-2">{p.pon_type}</Badge>}
            {p.track_serial && <Badge variant="secondary" className="ml-2">Lacak SN</Badge>}
          </p>
        </div>
        <Link
          href={`/inventory/products/${id}/card`}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Kartu Stok Lengkap
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Ringkasan</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Total stok: <b>{total} {p.units?.name ?? ""}</b></p>
            <p>Minimum stok: <b>{min}</b></p>
            <p>Status: <Badge variant={status === "Aman" ? "default" : status === "Habis" ? "destructive" : "outline"}>{status}</Badge></p>
            <p>Harga beli: {rupiah(Number(p.default_price))}</p>
            <p>Harga rata-rata: {rupiah(Number(p.avg_cost))}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Informasi</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Kategori: {p.categories?.name ?? "-"}</p>
            <p>Supplier: {p.suppliers?.name ?? "-"}</p>
            <p>Merk: {p.brand ?? "-"}</p>
            <p>Spesifikasi: {p.specification ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Stok per Site</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {balances.length === 0 && <p className="text-muted-foreground">Belum ada stok</p>}
            {balances.map((b, i) => (
              <p key={i} className="flex justify-between">
                <span>{b.sites?.name}</span><b>{Number(b.quantity)}</b>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Riwayat Mutasi Terbaru</CardTitle>
          <Link href={`/inventory/products/${id}/card`} className="text-sm text-muted-foreground hover:underline">
            Lihat semua di Kartu Stok
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>No. Transaksi</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Saldo Site</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">Belum ada mutasi</TableCell>
                </TableRow>
              )}
              {movements.map((m) => {
                const q = Number(m.change_qty);
                const t = m.stock_transactions;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{t?.transaction_date}</TableCell>
                    <TableCell>
                      {t ? (
                        <Link href={`/inventory/transactions/${t.id}`} className="font-mono text-xs hover:underline">
                          {t.transaction_number}
                        </Link>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{t?.transaction_type}</TableCell>
                    <TableCell>{m.sites?.name}</TableCell>
                    <TableCell className={`text-right font-medium ${q < 0 ? "text-red-600" : "text-green-700"}`}>
                      {q > 0 ? `+${q}` : q}
                    </TableCell>
                    <TableCell className="text-right">{Number(m.balance_after)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}