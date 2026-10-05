import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { OPNAME_LABEL, OPNAME_VARIANT, type OpnameStatus } from "@/lib/opname";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OpnameActions } from "@/components/inventory/opname-actions";

type Item = {
  product_id: string; system_stock: number; physical_stock: number; difference: number; reason: string | null;
  products: { code: string; name: string; units: { name: string } | null } | null;
};

type Opname = {
  id: string; opname_number: string; opname_date: string; status: OpnameStatus;
  notes: string | null; review_note: string | null; adjustment_trx: string | null;
  sites: { name: string } | null;
  creator: { full_name: string | null } | null;
  reviewer: { full_name: string | null } | null;
  stock_opname_items: Item[];
};

export default async function OpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data } = await supabase
    .from("stock_opnames")
    .select(`
      id, opname_number, opname_date, status, notes, review_note, adjustment_trx,
      sites(name),
      creator:profiles!stock_opnames_created_by_fkey(full_name),
      reviewer:profiles!stock_opnames_approved_by_fkey(full_name),
      stock_opname_items(product_id, system_stock, physical_stock, difference, reason, products(code, name, units(name)))
    `)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const op = data as unknown as Opname;

  let adjNumber: string | null = null;
  if (op.adjustment_trx) {
    const { data: trx } = await supabase
      .from("stock_transactions")
      .select("transaction_number")
      .eq("id", op.adjustment_trx)
      .maybeSingle();
    adjNumber = trx?.transaction_number ?? null;
  }

  const items = [...op.stock_opname_items].sort((a, b) =>
    (a.products?.name ?? "").localeCompare(b.products?.name ?? "")
  );
  const withDiff = items.filter((i) => Number(i.difference) !== 0).length;

  return (
    <div className="space-y-4">
      <Link href="/inventory/opname" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Stock Opname
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{op.opname_number}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {op.opname_date} · {op.sites?.name}
            <Badge variant={OPNAME_VARIANT[op.status]}>{OPNAME_LABEL[op.status]}</Badge>
          </p>
        </div>
        {profile && <OpnameActions id={op.id} status={op.status} role={profile.role} />}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-3">
          <p>Dibuat oleh: <b>{op.creator?.full_name ?? "-"}</b></p>
          <p>Barang dihitung: <b>{items.length}</b> ({withDiff} selisih)</p>
          <p>Keterangan: <b>{op.notes ?? "-"}</b></p>
          {op.reviewer && <p>Ditinjau oleh: <b>{op.reviewer.full_name}</b></p>}
          {op.review_note && <p className="sm:col-span-2">Catatan: <b>{op.review_note}</b></p>}
          {adjNumber && <p>Transaksi penyesuaian: <b className="font-mono">{adjNumber}</b></p>}
        </CardContent>
      </Card>

      {op.status === "DITOLAK" && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Opname ditolak, stok tidak berubah. Buat opname baru jika perlu menghitung ulang.
        </p>
      )}
      {(op.status === "DRAFT" || op.status === "DIAJUKAN") && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Stok sistem di bawah adalah catatan saat penghitungan. Saat disetujui, selisih dihitung ulang terhadap stok
          pada saat itu.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Hasil Hitung</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Sistem</TableHead>
                  <TableHead className="text-right">Fisik</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const d = Number(i.difference);
                  return (
                    <TableRow key={i.product_id}>
                      <TableCell>{i.products?.code}</TableCell>
                      <TableCell>
                        <Link href={`/inventory/products/${i.product_id}`} className="font-medium hover:underline">
                          {i.products?.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{Number(i.system_stock)}</TableCell>
                      <TableCell className="text-right">{Number(i.physical_stock)}</TableCell>
                      <TableCell className={`text-right font-medium ${d < 0 ? "text-red-600" : d > 0 ? "text-green-700" : ""}`}>
                        {d > 0 ? `+${d}` : d}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.reason ?? "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}