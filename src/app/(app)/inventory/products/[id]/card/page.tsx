import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { number, rupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StockCardExport } from "@/components/inventory/stock-card-export";
import type { Col, Row } from "@/lib/reports";

type Resp = { data: unknown[] | null; error: { message: string } | null };

async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<Resp>, max = 5000) {
  const rows: T[] = [];
  let error: string | undefined;
  for (let from = 0; from < max; from += 1000) {
    const res = await make(from, from + 999);
    if (res.error) { error = res.error.message; break; }
    const chunk = (res.data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return { rows, error };
}

type Mov = {
  id: string;
  site_id: string;
  change_qty: number;
  created_at: string;
  transaction_id: string;
  sites: { name: string } | null;
  stock_transactions: {
    id: string;
    transaction_number: string;
    transaction_type: string;
    transaction_date: string;
    reference_type: string | null;
    reference_id: string | null;
    requester: string | null;
    purpose: string | null;
    notes: string | null;
    source: { name: string } | null;
    dest: { name: string } | null;
    profiles: { full_name: string | null } | null;
  } | null;
};

type Line = {
  id: string;
  txId: string;
  date: string;
  no: string;
  type: string;
  site: string;
  route: string;
  inQty: number;
  outQty: number;
  run: number;
  price: number;
  who: string;
  ref: string;
  by: string;
  sn: string[];
  note: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 50;

const TYPE_LABEL: Record<string, string> = {
  IN: "Stock In", OUT: "Stock Out", TRANSFER: "Transfer", ADJUSTMENT: "Adjustment", RETURN: "Retur",
};

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

const buttonLike =
  "inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted";

export default async function StockCardPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; site?: string; type?: string; page?: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const sp = await searchParams;
  const from = ISO.test(sp.from ?? "") ? sp.from! : "";
  const to = ISO.test(sp.to ?? "") ? sp.to! : "";
  const site = UUID.test(sp.site ?? "") ? sp.site! : "";
  const type = sp.type && sp.type in TYPE_LABEL ? sp.type : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, code, name, track_serial, units(name)")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();
  const unit = (product.units as unknown as { name: string } | null)?.name ?? "";

  const [movRes, itemRes, snRes, sitesRes, balRes] = await Promise.all([
    fetchAll<Mov>((a, b) => {
      let q = supabase
        .from("stock_movements")
        .select(`
          id, site_id, change_qty, created_at, transaction_id,
          sites(name),
          stock_transactions!inner(
            id, transaction_number, transaction_type, transaction_date, reference_type, reference_id,
            requester, purpose, notes,
            source:sites!stock_transactions_source_site_id_fkey(name),
            dest:sites!stock_transactions_destination_site_id_fkey(name),
            profiles(full_name)
          )
        `)
        .eq("product_id", id);
      if (site) q = q.eq("site_id", site);
      return q.order("created_at").order("id").range(a, b);
    }),
    fetchAll<{ transaction_id: string; unit_price: number; notes: string | null }>((a, b) =>
      supabase.from("stock_transaction_items").select("transaction_id, unit_price, notes")
        .eq("product_id", id).order("id").range(a, b)
    ),
    fetchAll<{ transaction_id: string; serial_numbers: { serial_number: string } | null }>((a, b) =>
      supabase.from("stock_transaction_serials").select("transaction_id, serial_numbers(serial_number)")
        .eq("product_id", id).order("id").range(a, b)
    ),
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("stock_balances").select("quantity, sites(name)").eq("product_id", id),
  ]);

  const itemMap = new Map(itemRes.rows.map((i) => [i.transaction_id, i]));
  const snMap = new Map<string, string[]>();
  snRes.rows.forEach((s) => {
    if (s.serial_numbers) snMap.set(s.transaction_id, [...(snMap.get(s.transaction_id) ?? []), s.serial_numbers.serial_number]);
  });

  const poIds = [...new Set(
    movRes.rows
      .filter((m) => m.stock_transactions?.reference_type === "PO" && m.stock_transactions.reference_id)
      .map((m) => m.stock_transactions!.reference_id as string)
  )];
  const poMap = new Map<string, string>();
  for (let i = 0; i < poIds.length; i += 100) {
    const { data } = await supabase.from("purchase_orders").select("id, po_number").in("id", poIds.slice(i, i + 100));
    (data ?? []).forEach((p) => poMap.set(p.id, p.po_number));
  }

  const refLabel = (t: NonNullable<Mov["stock_transactions"]>) => {
    if (t.reference_type === "PO") return poMap.get(t.reference_id ?? "") ?? "PO";
    if (t.reference_type === "SALDO_AWAL") return "Saldo awal";
    if (t.reference_type === "IMPORT_SITE") return "Import Excel";
    if (t.reference_type === "OPNAME") return "Stock Opname";
    if (t.reference_type === "CLEAR_STOCK") return "Hapus stok";
    return "-";
  };

  // urutan buku besar: tanggal transaksi, lalu urutan pencatatan
  const sorted = movRes.rows
    .filter((m) => m.stock_transactions)
    .sort((a, b) =>
      a.stock_transactions!.transaction_date.localeCompare(b.stock_transactions!.transaction_date) ||
      a.created_at.localeCompare(b.created_at) ||
      Number(a.change_qty) - Number(b.change_qty) ||
      a.id.localeCompare(b.id)
    );

  let run = 0;
  const lines: Line[] = sorted.map((m) => {
    const t = m.stock_transactions!;
    const q = Number(m.change_qty);
    run += q;
    const item = itemMap.get(t.id);
    return {
      id: m.id,
      txId: t.id,
      date: t.transaction_date,
      no: t.transaction_number,
      type: t.transaction_type,
      site: m.sites?.name ?? "-",
      route: `${t.source?.name ?? "-"} → ${t.dest?.name ?? "-"}`,
      inQty: q > 0 ? q : 0,
      outQty: q < 0 ? -q : 0,
      run,
      price: Number(item?.unit_price ?? 0),
      who: [t.requester, t.purpose].filter(Boolean).join(" · "),
      ref: refLabel(t),
      by: t.profiles?.full_name ?? "-",
      sn: snMap.get(t.id) ?? [],
      note: [t.notes, item?.notes].filter(Boolean).join(" | "),
    };
  });

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const before = from ? lines.filter((l) => l.date < from) : [];
  const opening = before.length ? before[before.length - 1].run : 0;
  const period = lines.filter((l) => inRange(l.date));
  const closing = period.length ? period[period.length - 1].run : opening;
  const shownAsc = period.filter((l) => !type || l.type === type);
  const totalIn = shownAsc.reduce((s, l) => s + l.inQty, 0);
  const totalOut = shownAsc.reduce((s, l) => s + l.outQty, 0);

  const desc = [...shownAsc].reverse();
  const pageCount = Math.max(1, Math.ceil(desc.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = desc.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const siteName = sitesRes.data?.find((s) => s.id === site)?.name;
  const balances = (balRes.data ?? []) as unknown as { quantity: number; sites: { name: string } | null }[];

  const href = (p: number) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (site) qs.set("site", site);
    if (type) qs.set("type", type);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `/inventory/products/${id}/card${s ? `?${s}` : ""}`;
  };

  const cols: Col[] = [
    { key: "date", label: "Tanggal" },
    { key: "no", label: "No. Transaksi" },
    { key: "type", label: "Tipe" },
    { key: "site", label: "Site" },
    { key: "route", label: "Dari → Ke" },
    { key: "in", label: "Masuk", type: "number" },
    { key: "out", label: "Keluar", type: "number" },
    { key: "balance", label: "Saldo", type: "number" },
    { key: "price", label: "Harga", type: "currency" },
    { key: "who", label: "Pemakai / Keperluan" },
    { key: "ref", label: "Referensi" },
    { key: "by", label: "Oleh" },
    { key: "sn", label: "Nomor SN" },
    { key: "note", label: "Keterangan" },
  ];
  const exportRows: Row[] = [
    {
      date: from || null, no: null, type: "Saldo awal", site: siteName ?? "Semua site", route: null,
      in: null, out: null, balance: opening, price: null, who: null, ref: null, by: null, sn: null, note: null,
    },
    ...shownAsc.map((l) => ({
      date: l.date, no: l.no, type: TYPE_LABEL[l.type] ?? l.type, site: l.site, route: l.route,
      in: l.inQty || null, out: l.outQty || null, balance: l.run, price: l.price || null,
      who: l.who || null, ref: l.ref, by: l.by, sn: l.sn.join(", ") || null, note: l.note || null,
    })),
  ];
  const subtitle = [
    `${product.code}`,
    from || to ? `Periode: ${from || "..."} s/d ${to || "..."}` : "Semua periode",
    siteName ? `Site: ${siteName}` : "Semua site",
    type ? `Tipe: ${TYPE_LABEL[type]}` : "",
  ].filter(Boolean).join("  |  ");

  const stat = (label: string, value: string, tone = "") => (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Link href={`/inventory/products/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke detail barang
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kartu Stok: {product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {product.code}{unit && ` · satuan ${unit}`}{product.track_serial && " · dilacak per SN"}
          </p>
        </div>
        <StockCardExport title={`Kartu Stok ${product.name}`} subtitle={subtitle} cols={cols} rows={exportRows} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Saldo awal", number(opening))}
        {stat("Total masuk", `+${number(totalIn)}`, "text-green-700")}
        {stat("Total keluar", `-${number(totalOut)}`, "text-red-600")}
        {stat("Saldo akhir", number(closing))}
      </div>

      {balances.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Stok saat ini:</span>
          {balances.map((b, i) => (
            <Badge key={i} variant="outline">{b.sites?.name}: {number(Number(b.quantity))}</Badge>
          ))}
        </div>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dari tanggal</label>
          <input type="date" name="from" defaultValue={from} className={selectClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sampai tanggal</label>
          <input type="date" name="to" defaultValue={to} className={selectClass} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Site</label>
          <select name="site" defaultValue={site} className={selectClass}>
            <option value="">Semua site</option>
            {(sitesRes.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipe</label>
          <select name="type" defaultValue={type} className={selectClass}>
            <option value="">Semua tipe</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Tampilkan
        </button>
        <Link href={`/inventory/products/${id}/card`} className={buttonLike}>Reset</Link>
      </form>

      {(movRes.error || movRes.rows.length >= 5000) && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {movRes.error ?? "Data dibatasi 5.000 mutasi terakhir untuk satu barang."}
        </p>
      )}
      {!site && (
        <p className="text-xs text-muted-foreground">
          Saldo dihitung gabungan semua site. Transfer tampil dua baris (keluar dari site asal, masuk ke site tujuan)
          dan tidak mengubah total. Pilih satu site untuk melihat saldo site itu saja.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>No. Transaksi</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Dari → Ke</TableHead>
              <TableHead className="text-right">Masuk</TableHead>
              <TableHead className="text-right">Keluar</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Pemakai / Keperluan</TableHead>
              <TableHead>Referensi</TableHead>
              <TableHead>Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Belum ada mutasi untuk filter ini
                </TableCell>
              </TableRow>
            )}
            {visible.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap">{l.date}</TableCell>
                <TableCell>
                  <Link href={`/inventory/transactions/${l.txId}`} className="font-mono text-xs font-medium hover:underline">
                    {l.no}
                  </Link>
                  {l.sn.length > 0 && (
                    <div className="mt-1 flex max-w-60 flex-wrap gap-1">
                      {l.sn.slice(0, 6).map((s) => (
                        <Link
                          key={s} href={`/inventory/serials?q=${encodeURIComponent(s)}`}
                          className="rounded border px-1.5 font-mono text-[11px] hover:bg-muted"
                        >
                          {s}
                        </Link>
                      ))}
                      {l.sn.length > 6 && <span className="text-[11px] text-muted-foreground">+{l.sn.length - 6}</span>}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={l.type === "OUT" ? "destructive" : "secondary"}>{TYPE_LABEL[l.type] ?? l.type}</Badge>
                </TableCell>
                <TableCell>{l.site}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{l.route}</TableCell>
                <TableCell className="text-right font-medium text-green-700">{l.inQty ? `+${number(l.inQty)}` : ""}</TableCell>
                <TableCell className="text-right font-medium text-red-600">{l.outQty ? `-${number(l.outQty)}` : ""}</TableCell>
                <TableCell className="text-right font-semibold">{number(l.run)}</TableCell>
                <TableCell className="text-sm">
                  {l.who || "-"}
                  {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                  {l.inQty > 0 && l.price > 0 && (
                    <p className="text-xs text-muted-foreground">Harga {rupiah(l.price)}</p>
                  )}
                </TableCell>
                <TableCell className="text-xs">{l.ref}</TableCell>
                <TableCell className="text-xs">{l.by}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{shownAsc.length} mutasi</span>
        <div className="flex items-center gap-2">
          {current > 1 ? (
            <Link href={href(current - 1)} className={buttonLike}>Sebelumnya</Link>
          ) : <Button variant="outline" size="sm" disabled>Sebelumnya</Button>}
          <span>{current} / {pageCount}</span>
          {current < pageCount ? (
            <Link href={href(current + 1)} className={buttonLike}>Berikutnya</Link>
          ) : <Button variant="outline" size="sm" disabled>Berikutnya</Button>}
        </div>
      </div>
    </div>
  );
}