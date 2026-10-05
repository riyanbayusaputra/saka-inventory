import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { rupiah } from "@/lib/format";
import { STATUS_LABEL, STATUS_LIST, STATUS_VARIANT, type PoStatus } from "@/lib/po";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = {
  id: string; po_number: string; po_date: string; status: PoStatus; area: string | null;
  suppliers: { name: string } | null; sites: { name: string } | null;
};

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = STATUS_LIST.includes(status as PoStatus) ? (status as PoStatus) : null;

  const supabase = await createClient();
  const profile = await getProfile();

  let query = supabase
    .from("purchase_orders")
    .select("id, po_number, po_date, status, area, suppliers(name), sites(name)")
    .order("po_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (active) query = query.eq("status", active);

  const [list, totals] = await Promise.all([
    query,
    supabase.from("v_po_totals").select("id, total"),
  ]);

  const rows = (list.data ?? []) as unknown as Row[];
  const totalMap = new Map((totals.data ?? []).map((t) => [t.id as string, Number(t.total)]));
  const canCreate = profile?.role === "ADMIN" || profile?.role === "STAFF";

  const tab = (href: string, label: string, on: boolean) => (
    <Link
      key={label}
      href={href}
      className={`rounded-full border px-3 py-1 text-sm ${on ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchase Order</h1>
          <p className="text-sm text-muted-foreground">Pengadaan barang dari supplier.</p>
        </div>
        {canCreate && (
          <Link
            href="/procurement/purchase-orders/new"
            className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Buat PO
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tab("/procurement/purchase-orders", "Semua", !active)}
        {STATUS_LIST.map((s) =>
          tab(`/procurement/purchase-orders?status=${s}`, STATUS_LABEL[s], active === s)
        )}
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. PO</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Belum ada PO</TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/procurement/purchase-orders/${r.id}`} className="font-mono text-sm font-medium hover:underline">
                    {r.po_number}
                  </Link>
                </TableCell>
                <TableCell>{r.po_date}</TableCell>
                <TableCell>{r.suppliers?.name ?? "-"}</TableCell>
                <TableCell>{r.sites?.name ?? "-"}</TableCell>
                <TableCell>{r.area ?? "-"}</TableCell>
                <TableCell className="text-right">{rupiah(totalMap.get(r.id) ?? 0)}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}