import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { rupiah } from "@/lib/format";
import { RECEIVABLE, STATUS_LABEL, STATUS_VARIANT, type PoStatus } from "@/lib/po";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PoActions } from "@/components/procurement/po-actions";
import { ReceiveForm, type ReceiveLine } from "@/components/procurement/receive-form";

type Item = {
  product_id: string; section: string | null; specification: string | null;
  quantity: number; received_qty: number; unit_price: number; discount: number; subtotal: number;
  line_no: number;
  products: { code: string; name: string; units: { name: string } | null } | null;
};

type Po = {
  id: string; po_number: string; po_date: string; status: PoStatus;
  area: string | null; route: string | null; principal: string | null; notes: string | null;
  site_id: string | null;
  suppliers: { name: string } | null;
  sites: { name: string } | null;
  purchase_order_items: Item[];
};

type Receipt = {
  id: string; transaction_number: string; transaction_date: string; notes: string | null;
  profiles: { full_name: string | null } | null;
  stock_transaction_items: { quantity: number; products: { name: string } | null }[];
};

export default async function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const [poRes, receiptRes, sitesRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(`
        id, po_number, po_date, status, area, route, principal, notes, site_id,
        suppliers(name), sites(name),
        purchase_order_items(
          product_id, section, specification, quantity, received_qty, unit_price,
          discount, subtotal, line_no, products(code, name, units(name))
        )
      `)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("stock_transactions")
      .select("id, transaction_number, transaction_date, notes, profiles(full_name), stock_transaction_items(quantity, products(name))")
      .eq("reference_type", "PO")
      .eq("reference_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!poRes.data) notFound();

  const po = poRes.data as unknown as Po;
  const receipts = (receiptRes.data ?? []) as unknown as Receipt[];
  const items = [...po.purchase_order_items].sort((a, b) => a.line_no - b.line_no);
  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);

  const lines: ReceiveLine[] = items
    .map((i) => ({
      product_id: i.product_id,
      name: i.products?.name ?? "-",
      unit: i.products?.units?.name ?? null,
      remaining: Number(i.quantity) - Number(i.received_qty),
    }))
    .filter((l) => l.remaining > 0);

  const canWrite = profile?.role === "ADMIN" || profile?.role === "STAFF";
  const canReceive = canWrite && RECEIVABLE.includes(po.status) && lines.length > 0;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <div className="space-y-4">
      <Link href="/procurement/purchase-orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Purchase Order
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{po.po_number}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {po.po_date} <Badge variant={STATUS_VARIANT[po.status]}>{STATUS_LABEL[po.status]}</Badge>
          </p>
        </div>
        {profile && <PoActions poId={po.id} status={po.status} role={profile.role} />}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-3">
          <p>Supplier: <b>{po.suppliers?.name ?? "-"}</b></p>
          <p>Site penerimaan: <b>{po.sites?.name ?? "-"}</b></p>
          <p>Principal: <b>{po.principal ?? "-"}</b></p>
          <p>Area: <b>{po.area ?? "-"}</b></p>
          <p>P. Rute: <b>{po.route ?? "-"}</b></p>
          <p>Keterangan: <b>{po.notes ?? "-"}</b></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rincian Barang</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">No</TableHead>
                  <TableHead>Bagian</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Diterima</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Diskon</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i, idx) => (
                  <TableRow key={i.product_id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.section ?? "-"}</TableCell>
                    <TableCell>
                      <p className="font-medium">{i.products?.name}</p>
                      {i.specification && <p className="text-xs text-muted-foreground">{i.specification}</p>}
                    </TableCell>
                    <TableCell className="text-right">{Number(i.quantity)} {i.products?.units?.name ?? ""}</TableCell>
                    <TableCell className="text-right">{Number(i.received_qty)}</TableCell>
                    <TableCell className="text-right">{rupiah(Number(i.unit_price))}</TableCell>
                    <TableCell className="text-right">{Number(i.discount) ? rupiah(Number(i.discount)) : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{rupiah(Number(i.subtotal))}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={7} className="text-right font-bold">Total</TableCell>
                  <TableCell className="text-right text-base font-bold">{rupiah(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canReceive && (
        <ReceiveForm
          poId={po.id}
          lines={lines}
          sites={sitesRes.data ?? []}
          defaultSiteId={po.site_id}
          today={today}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat Penerimaan</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {receipts.length === 0 && <p className="text-muted-foreground">Belum ada penerimaan barang.</p>}
          {receipts.map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <p className="font-mono text-xs">{r.transaction_number} · {r.transaction_date} · {r.profiles?.full_name ?? "-"}</p>
              <p className="mt-1">
                {r.stock_transaction_items.map((i) => `${i.products?.name} × ${Number(i.quantity)}`).join(", ")}
              </p>
              {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}