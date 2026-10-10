import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { number, rupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DeleteTransactionButton } from "@/components/inventory/delete-transaction-button";

type Item = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  products: { code: string; name: string; units: { name: string } | null } | null;
};

type Trx = {
  id: string;
  transaction_number: string;
  transaction_type: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT" | "RETURN";
  transaction_date: string;
  reference_type: string | null;
  reference_id: string | null;
  requester: string | null;
  purpose: string | null;
  notes: string | null;
  created_at: string;
  source: { name: string } | null;
  dest: { name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
  stock_transaction_items: Item[];
};

type Effect = {
  product_id: string;
  change_qty: number;
  balance_after: number;
  sites: { name: string } | null;
  products: { name: string } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_LABEL = {
  IN: "Stock In", OUT: "Stock Out", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment", RETURN: "Retur",
} as const;

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const profile = await getProfile();

  const [trxRes, snRes, effRes] = await Promise.all([
    supabase
      .from("stock_transactions")
      .select(`
        id, transaction_number, transaction_type, transaction_date, reference_type, reference_id,
        requester, purpose, notes, created_at,
        source:sites!stock_transactions_source_site_id_fkey(name),
        dest:sites!stock_transactions_destination_site_id_fkey(name),
        profiles(full_name, email),
        stock_transaction_items(id, product_id, quantity, unit_price, subtotal, notes, products(code, name, units(name)))
      `)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("stock_transaction_serials")
      .select("product_id, serial_numbers(serial_number)")
      .eq("transaction_id", id),
    supabase
      .from("stock_movements")
      .select("product_id, change_qty, balance_after, sites(name), products(name)")
      .eq("transaction_id", id),
  ]);

  if (!trxRes.data) notFound();
  const t = trxRes.data as unknown as Trx;
  const effects = (effRes.data ?? []) as unknown as Effect[];

  const snByProduct = new Map<string, string[]>();
  ((snRes.data ?? []) as unknown as { product_id: string; serial_numbers: { serial_number: string } | null }[])
    .forEach((s) => {
      if (s.serial_numbers) {
        snByProduct.set(s.product_id, [...(snByProduct.get(s.product_id) ?? []), s.serial_numbers.serial_number]);
      }
    });

  // sumber transaksi
  let ref: { label: string; href?: string } | null = null;
  if (t.reference_type === "PO" && t.reference_id) {
    const { data } = await supabase.from("purchase_orders").select("po_number").eq("id", t.reference_id).maybeSingle();
    ref = { label: `Penerimaan PO ${data?.po_number ?? ""}`.trim(), href: `/procurement/purchase-orders/${t.reference_id}` };
  } else if (t.reference_type === "OPNAME" && t.reference_id) {
    const { data } = await supabase.from("stock_opnames").select("opname_number").eq("id", t.reference_id).maybeSingle();
    ref = { label: `Stock Opname ${data?.opname_number ?? ""}`.trim(), href: `/inventory/opname/${t.reference_id}` };
  } else if (t.reference_type === "SALDO_AWAL") ref = { label: "Saldo awal" };
  else if (t.reference_type === "IMPORT_SITE") ref = { label: "Import dari Excel" };
  else if (t.reference_type === "CLEAR_STOCK") ref = { label: "Hapus stok" };

  const items = [...t.stock_transaction_items].sort((a, b) =>
    (a.products?.name ?? "").localeCompare(b.products?.name ?? "")
  );
  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const hasPrice = items.some((i) => Number(i.unit_price) > 0);
  const isAdmin = profile?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <Link href="/inventory/transactions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Transaksi
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{t.transaction_number}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {t.transaction_date}
            <Badge variant={t.transaction_type === "OUT" ? "destructive" : "secondary"}>
              {TYPE_LABEL[t.transaction_type]}
            </Badge>
          </p>
        </div>
        {isAdmin && t.reference_type !== "OPNAME" && (
          <DeleteTransactionButton
            id={t.id}
            number={t.transaction_number}
            redirectTo="/inventory/transactions"
            withLabel
          />
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>Dari: <b>{t.source?.name ?? "-"}</b></p>
          <p>Ke: <b>{t.dest?.name ?? "-"}</b></p>
          <p>Diinput oleh: <b>{t.profiles?.full_name || t.profiles?.email || "-"}</b></p>
          <p>Waktu input: <b>{new Date(t.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</b></p>
          {t.requester && <p>Pemakai: <b>{t.requester}</b></p>}
          {t.purpose && <p>Keperluan: <b>{t.purpose}</b></p>}
          {ref && (
            <p>
              Sumber:{" "}
              {ref.href ? (
                <Link href={ref.href} className="font-bold hover:underline">{ref.label}</Link>
              ) : (
                <b>{ref.label}</b>
              )}
            </p>
          )}
          {t.notes && <p className="sm:col-span-2 lg:col-span-3">Keterangan: <b>{t.notes}</b></p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Barang</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  {hasPrice && <TableHead className="text-right">Harga</TableHead>}
                  {hasPrice && <TableHead className="text-right">Subtotal</TableHead>}
                  <TableHead>Nomor SN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const sns = snByProduct.get(i.product_id) ?? [];
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{i.products?.code}</TableCell>
                      <TableCell>
                        <Link href={`/inventory/products/${i.product_id}/card`} className="font-medium hover:underline">
                          {i.products?.name}
                        </Link>
                        {i.notes && <p className="text-xs text-muted-foreground">{i.notes}</p>}
                      </TableCell>
                      <TableCell className="text-right">
                        {number(Number(i.quantity))} {i.products?.units?.name ?? ""}
                      </TableCell>
                      {hasPrice && <TableCell className="text-right">{rupiah(Number(i.unit_price))}</TableCell>}
                      {hasPrice && <TableCell className="text-right">{rupiah(Number(i.subtotal))}</TableCell>}
                      <TableCell>
                        {sns.length === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {sns.map((s) => (
                              <Link
                                key={s} href={`/inventory/serials?q=${encodeURIComponent(s)}`}
                                className="rounded border px-1.5 font-mono text-xs hover:bg-muted"
                              >
                                {s}
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {hasPrice && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{rupiah(total)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dampak ke Stok</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barang</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Perubahan</TableHead>
                <TableHead className="text-right">Saldo Site Setelahnya</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {effects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">Tidak ada data</TableCell>
                </TableRow>
              )}
              {effects.map((e, i) => {
                const q = Number(e.change_qty);
                return (
                  <TableRow key={i}>
                    <TableCell>{e.products?.name}</TableCell>
                    <TableCell>{e.sites?.name}</TableCell>
                    <TableCell className={`text-right font-medium ${q < 0 ? "text-red-600" : "text-green-700"}`}>
                      {q > 0 ? `+${number(q)}` : number(q)}
                    </TableCell>
                    <TableCell className="text-right">{number(Number(e.balance_after))}</TableCell>
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