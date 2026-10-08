import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DeleteTransactionButton } from "@/components/inventory/delete-transaction-button";

type Trx = {
  id: string;
  transaction_number: string;
  transaction_type: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT" | "RETURN";
  transaction_date: string;
  reference_type: string | null;
  source: { name: string } | null;
  dest: { name: string } | null;
  profiles: { full_name: string | null } | null;
  stock_transaction_items: { quantity: number; products: { name: string } | null }[];
};

const TYPE_LABEL = {
  IN: "Stock In", OUT: "Stock Out", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment", RETURN: "Retur",
} as const;

export default async function TransactionsPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const isAdmin = profile?.role === "ADMIN";

  const { data } = await supabase
    .from("stock_transactions")
    .select(`
      id, transaction_number, transaction_type, transaction_date, reference_type,
      source:sites!stock_transactions_source_site_id_fkey(name),
      dest:sites!stock_transactions_destination_site_id_fkey(name),
      profiles(full_name),
      stock_transaction_items(quantity, products(name))
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Trx[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Transaksi</h1>
        <p className="text-sm text-muted-foreground">
          200 transaksi terbaru.
          {isAdmin && " Admin dapat menghapus transaksi; stok otomatis dikembalikan dan penghapusan tercatat di Audit Log."}
        </p>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No. Transaksi</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Dari</TableHead>
              <TableHead>Ke</TableHead>
              <TableHead>Barang</TableHead>
              <TableHead>Oleh</TableHead>
              {isAdmin && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center text-muted-foreground">
                  Belum ada transaksi
                </TableCell>
              </TableRow>
            )}
            {rows.map((t) => {
              const items = t.stock_transaction_items;
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.transaction_date}</TableCell>
                  <TableCell className="font-mono text-xs">{t.transaction_number}</TableCell>
                  <TableCell>
                    <Badge variant={t.transaction_type === "OUT" ? "destructive" : "secondary"}>
                      {TYPE_LABEL[t.transaction_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.source?.name ?? "-"}</TableCell>
                  <TableCell>{t.dest?.name ?? "-"}</TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {items.slice(0, 3).map((i, idx) => (
                      <div key={idx}>{i.products?.name} × {Number(i.quantity)}</div>
                    ))}
                    {items.length > 3 && (
                      <div className="text-xs text-muted-foreground">+{items.length - 3} barang lain</div>
                    )}
                  </TableCell>
                  <TableCell>{t.profiles?.full_name ?? "-"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      {t.reference_type === "OPNAME" ? (
                        <span className="text-xs text-muted-foreground">Opname</span>
                      ) : (
                        <DeleteTransactionButton id={t.id} number={t.transaction_number} />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}