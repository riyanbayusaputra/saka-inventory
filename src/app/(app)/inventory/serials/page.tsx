import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SerialRegister } from "@/components/inventory/serial-register";

type History = {
  created_at: string;
  stock_transactions: {
    transaction_number: string;
    transaction_type: string;
    transaction_date: string;
    requester: string | null;
    source: { name: string } | null;
    dest: { name: string } | null;
  } | null;
};

type Serial = {
  id: string;
  serial_number: string;
  status: "IN_STOCK" | "OUT";
  customer: string | null;
  // 1. di type Serial:
products: { name: string; pon_type: string | null } | null;
  sites: { name: string } | null;
  stock_transaction_serials: History[];
};

type Coverage = {
  product_id: string; product_name: string; site_id: string; site_name: string;
  stock: number; with_sn: number; without_sn: number;
};

const TYPE_LABEL: Record<string, string> = {
  IN: "Masuk", OUT: "Keluar", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment", RETURN: "Retur",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export default async function SerialsPage({
  searchParams,
}: {
  // 2. searchParams: tambah pon
searchParams: Promise<{ q?: string; status?: string; site?: string; product?: string; pon?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").replace(/[%,()*\s]/g, "").toUpperCase();
  const status = sp.status === "IN_STOCK" || sp.status === "OUT" ? sp.status : "";
  const site = UUID.test(sp.site ?? "") ? sp.site! : "";
  const product = UUID.test(sp.product ?? "") ? sp.product! : "";
  // lalu setelah baris `const product = ...`:
const pon = sp.pon === "GPON" || sp.pon === "EPON" ? sp.pon : "";

  const supabase = await createClient();
  const profile = await getProfile();

  let query = supabase
    .from("serial_numbers")
    .select(`
      id, serial_number, status, customer,
   
products!inner(name, pon_type),
      sites:sites!serial_numbers_site_id_fkey(name),
      stock_transaction_serials(
        created_at,
        stock_transactions(
          transaction_number, transaction_type, transaction_date, requester,
          source:sites!stock_transactions_source_site_id_fkey(name),
          dest:sites!stock_transactions_destination_site_id_fkey(name)
        )
      )
    `, { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("serial_number", `%${q}%`);
  if (status) query = query.eq("status", status);
  if (site) query = query.eq("site_id", site);
  if (product) query = query.eq("product_id", product);
  if (pon) query = query.eq("products.pon_type", pon);

  const [list, cov, tracked, sites] = await Promise.all([
    query,
    supabase.from("v_serial_coverage").select("*").order("product_name").order("site_name").limit(1000),
    supabase.from("products").select("id, name").eq("track_serial", true).eq("is_active", true).order("name"),
    supabase.from("sites").select("id, name").eq("is_active", true).order("name"),
  ]);

  const rows = (list.data ?? []) as unknown as Serial[];
  const coverage = (cov.data ?? []) as Coverage[];
  const trackedList = tracked.data ?? [];
  const siteList = sites.data ?? [];
  const missing = coverage.reduce((s, c) => s + Number(c.without_sn), 0);
  const canWrite = profile?.role === "ADMIN" || profile?.role === "STAFF";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Nomor SN</h1>
        <p className="text-sm text-muted-foreground">
          Pelacakan per unit untuk barang yang dicentang &quot;Lacak SN&quot; (router). Cari SN untuk melihat lokasi dan riwayatnya.
        </p>
      </div>

      {trackedList.length === 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Belum ada barang yang dilacak per SN. Centang &quot;Lacak SN&quot; pada barang di menu Barang.
        </p>
      )}

      {coverage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Kelengkapan SN {missing > 0 && <Badge variant="outline" className="ml-2">{missing} unit belum ber-SN</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barang</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Ber-SN</TableHead>
                    <TableHead className="text-right">Tanpa SN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverage.map((c) => (
                    <TableRow key={`${c.product_id}|${c.site_id}`}>
                      <TableCell>{c.product_name}</TableCell>
                      <TableCell>{c.site_name}</TableCell>
                      <TableCell className="text-right">{Number(c.stock)}</TableCell>
                      <TableCell className="text-right">{Number(c.with_sn)}</TableCell>
                      <TableCell className={`text-right ${Number(c.without_sn) > 0 ? "font-medium text-amber-700" : ""}`}>
                        {Number(c.without_sn)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {canWrite && trackedList.length > 0 && <SerialRegister products={trackedList} sites={siteList} />}

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q" defaultValue={q} placeholder="Cari nomor SN..."
          className="h-9 min-w-56 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <select name="product" defaultValue={product} className={selectClass}>
          <option value="">Semua barang</option>
          {trackedList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
   
<select name="pon" defaultValue={pon} className={selectClass}>
  <option value="">GPON &amp; EPON</option>
  <option value="GPON">GPON</option>
  <option value="EPON">EPON</option>
</select>
        <select name="site" defaultValue={site} className={selectClass}>
          <option value="">Semua site</option>
          {siteList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="status" defaultValue={status} className={selectClass}>
          <option value="">Semua status</option>
          <option value="IN_STOCK">Tersedia</option>
          <option value="OUT">Keluar</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Cari
        </button>
      </form>

      {list.error && <p className="text-sm text-red-600">{list.error.message}</p>}

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. SN</TableHead>
              <TableHead>Barang</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pemakai</TableHead>
              <TableHead>Riwayat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Belum ada SN yang cocok
                </TableCell>
              </TableRow>
            )}
            {rows.map((s) => {
              const hist = [...s.stock_transaction_serials].sort((a, b) => a.created_at.localeCompare(b.created_at));
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm font-medium">{s.serial_number}</TableCell>
                 <TableCell>
  {s.products?.name}
  {s.products?.pon_type && <Badge variant="outline" className="ml-2">{s.products.pon_type}</Badge>}
</TableCell>
                  <TableCell>{s.sites?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "IN_STOCK" ? "default" : "secondary"}>
                      {s.status === "IN_STOCK" ? "Tersedia" : "Keluar"}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.customer ?? "-"}</TableCell>
                  <TableCell className="min-w-64 text-xs">
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">{hist.length} catatan</summary>
                      <div className="mt-1 space-y-1">
                        {hist.length === 0 && <p>Terdaftar dari stok lama (belum ada transaksi)</p>}
                        {hist.map((h, i) => {
                          const t = h.stock_transactions;
                          if (!t) return null;
                          return (
                            <p key={i}>
                              {t.transaction_date} · {TYPE_LABEL[t.transaction_type] ?? t.transaction_type} ·{" "}
                              <span className="font-mono">{t.transaction_number}</span>
                              {(t.source || t.dest) && ` · ${t.source?.name ?? ""} → ${t.dest?.name ?? ""}`}
                              {t.requester && ` · ${t.requester}`}
                            </p>
                          );
                        })}
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {list.count ?? rows.length} SN{(list.count ?? 0) > 200 && " (menampilkan 200 terbaru, persempit pencarian)"}
      </p>
    </div>
  );
}