import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import {
  OPNAME_LABEL, OPNAME_STATUS_LIST, OPNAME_VARIANT, type OpnameStatus,
} from "@/lib/opname";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Row = {
  id: string; opname_number: string; opname_date: string; status: OpnameStatus;
  sites: { name: string } | null;
  creator: { full_name: string | null } | null;
  stock_opname_items: { difference: number }[];
};

export default async function OpnameListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = OPNAME_STATUS_LIST.includes(status as OpnameStatus) ? (status as OpnameStatus) : null;

  const supabase = await createClient();
  const profile = await getProfile();

  let query = supabase
    .from("stock_opnames")
    .select(`
      id, opname_number, opname_date, status,
      sites(name),
      creator:profiles!stock_opnames_created_by_fkey(full_name),
      stock_opname_items(difference)
    `)
    .order("opname_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (active) query = query.eq("status", active);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const canCreate = profile?.role === "ADMIN" || profile?.role === "STAFF";

  const tab = (href: string, text: string, on: boolean) => (
    <Link
      key={text}
      href={href}
      className={`rounded-full border px-3 py-1 text-sm ${on ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {text}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock Opname</h1>
          <p className="text-sm text-muted-foreground">Pencocokan stok sistem dengan stok fisik per site.</p>
        </div>
        {canCreate && (
          <Link href="/inventory/opname/new" className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" /> Opname Baru
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tab("/inventory/opname", "Semua", !active)}
        {OPNAME_STATUS_LIST.map((s) => tab(`/inventory/opname?status=${s}`, OPNAME_LABEL[s], active === s))}
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Opname</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Barang</TableHead>
              <TableHead className="text-right">Selisih</TableHead>
              <TableHead>Dibuat oleh</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Belum ada stock opname</TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const withDiff = r.stock_opname_items.filter((i) => Number(i.difference) !== 0).length;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/inventory/opname/${r.id}`} className="font-mono text-sm font-medium hover:underline">
                      {r.opname_number}
                    </Link>
                  </TableCell>
                  <TableCell>{r.opname_date}</TableCell>
                  <TableCell>{r.sites?.name ?? "-"}</TableCell>
                  <TableCell className="text-right">{r.stock_opname_items.length}</TableCell>
                  <TableCell className={`text-right ${withDiff ? "font-medium text-red-600" : ""}`}>
                    {withDiff ? `${withDiff} barang` : "Sesuai"}
                  </TableCell>
                  <TableCell>{r.creator?.full_name ?? "-"}</TableCell>
                  <TableCell><Badge variant={OPNAME_VARIANT[r.status]}>{OPNAME_LABEL[r.status]}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}