import { createClient } from "@/lib/supabase/server";
import { StockTable, type StockRow } from "@/components/inventory/stock-table";

export default async function StockPage() {
  const supabase = await createClient();
  const [stock, sites] = await Promise.all([
    supabase.from("v_stock_status").select("*").order("product_name"),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stok</h1>
        <p className="text-sm text-muted-foreground">Stok barang per site. Klik nama barang untuk melihat riwayat.</p>
      </div>
      <StockTable rows={(stock.data ?? []) as StockRow[]} sites={sites.data ?? []} />
    </div>
  );
}