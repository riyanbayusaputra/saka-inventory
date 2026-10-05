import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Log = {
  id: string; user_id: string | null; action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string; record_id: string | null;
  old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 50;

const TABLES: Record<string, string> = {
  products: "Barang",
  categories: "Kategori",
  sites: "Site",
  suppliers: "Supplier",
  purchase_orders: "Purchase Order",
  stock_opnames: "Stock Opname",
  profiles: "User",
};

const ACTION_LABEL = { INSERT: "Tambah", UPDATE: "Ubah", DELETE: "Hapus" } as const;
const ACTION_VARIANT = { INSERT: "default", UPDATE: "secondary", DELETE: "destructive" } as const;

const short = (v: unknown) => {
  const s = v === null || v === undefined ? "kosong" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
};

function recordName(l: Log) {
  const v = l.new_value ?? l.old_value ?? {};
  return String(v.name ?? v.po_number ?? v.opname_number ?? v.email ?? v.code ?? l.record_id ?? "-");
}

function describe(l: Log) {
  if (l.action === "UPDATE" && l.old_value && l.new_value) {
    const keys = Object.keys(l.new_value).filter(
      (k) => k !== "updated_at" && JSON.stringify(l.old_value![k]) !== JSON.stringify(l.new_value![k])
    );
    if (keys.length === 0) return "Tidak ada perubahan nilai";
    return keys.slice(0, 4).map((k) => `${k}: ${short(l.old_value![k])} → ${short(l.new_value![k])}`)
      .concat(keys.length > 4 ? [`+${keys.length - 4} kolom lain`] : []);
  }
  return l.action === "INSERT" ? "Data baru dibuat" : "Data dihapus";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; page?: string }>;
}) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const table = sp.table && sp.table in TABLES ? sp.table : null;

  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("*", { count: "exact" });
  if (table) q = q.eq("table_name", table);
  const { data, count } = await q
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const logs = (data ?? []) as Log[];
  const ids = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const names = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.email || "-"]));

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, t: string | null) =>
    `/audit-log?${new URLSearchParams({ ...(t ? { table: t } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Riwayat perubahan data master, PO, opname, dan user. Perubahan stok tercatat di menu Transaksi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={href(1, null)} className={`rounded-full border px-3 py-1 text-sm ${!table ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          Semua
        </Link>
        {Object.entries(TABLES).map(([key, label]) => (
          <Link key={key} href={href(1, key)}
            className={`rounded-full border px-3 py-1 text-sm ${table === key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Perubahan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada catatan</TableCell>
              </TableRow>
            )}
            {logs.map((l) => {
              const d = describe(l);
              return (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(l.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                  </TableCell>
                  <TableCell>{l.user_id ? names.get(l.user_id) ?? "-" : "Sistem"}</TableCell>
                  <TableCell><Badge variant={ACTION_VARIANT[l.action]}>{ACTION_LABEL[l.action]}</Badge></TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground">{TABLES[l.table_name] ?? l.table_name}</p>
                    <p className="font-medium">{recordName(l)}</p>
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground">
                    {Array.isArray(d) ? d.map((x, i) => <div key={i}>{x}</div>) : d}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} catatan</span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1, table)} className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">Sebelumnya</Link>
          ) : <Button variant="outline" size="sm" disabled>Sebelumnya</Button>}
          <span>{page} / {pageCount}</span>
          {page < pageCount ? (
            <Link href={href(page + 1, table)} className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">Berikutnya</Link>
          ) : <Button variant="outline" size="sm" disabled>Berikutnya</Button>}
        </div>
      </div>
    </div>
  );
}