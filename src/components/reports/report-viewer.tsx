"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { runReport } from "@/lib/actions/reports";
import { exportCsv, exportPdf, exportXlsx, formatCell } from "@/lib/export";

type ReportType = Parameters<typeof runReport>[0];
type Filters = Parameters<typeof runReport>[1];

type Opt = { id: string; name: string };
type ReportData = Awaited<ReturnType<typeof runReport>>;
type ReportConfig = {
  title: string;
  desc: string;
  filters: Array<
    "date" | "site" | "category" | "supplier" | "trxType" | "status" | "q"
  >;
  statusOptions?: { value: string; label: string }[];
};

const REPORTS: Record<ReportType, ReportConfig> = {} as Record<
  ReportType,
  ReportConfig
>;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SHOW_ROWS = 500;
const TRX_TYPE_OPTIONS = [
  { value: "IN", label: "Barang Masuk" },
  { value: "OUT", label: "Barang Keluar" },
];

export function ReportViewer({
  type,
  sites,
  categories,
  suppliers,
  defaultFrom,
  defaultTo,
}: {
  type: ReportType;
  sites: Opt[];
  categories: Opt[];
  suppliers: Opt[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const cfg: ReportConfig = REPORTS[type] ?? {
    title: "Laporan",
    desc: "Data laporan",
    filters: [],
  };
  const has = (k: (typeof cfg.filters)[number]) => cfg.filters.includes(k);

  const initial: Filters = has("date")
    ? { from: defaultFrom, to: defaultTo }
    : {};
  const [f, setF] = useState<Filters>(initial);
  const [data, setData] = useState<ReportData | null>(null);
  const [used, setUsed] = useState<Filters>(initial);
  const [pending, start] = useTransition();

  function run(next: Filters = f) {
    start(async () => {
      const res = await runReport(type, next);
      setData(res);
      setUsed(next);
      if (res.error) toast.error(res.error);
    });
  }

  useEffect(() => {
    run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }));

  function reset() {
    setF(initial);
    run(initial);
  }

  const subtitle = () => {
    const parts: string[] = [];
    if (used.from || used.to)
      parts.push(`Periode: ${used.from ?? "..."} s/d ${used.to ?? "..."}`);
    const name = (list: Opt[], id?: string) =>
      list.find((x) => x.id === id)?.name;
    if (used.siteId) parts.push(`Site: ${name(sites, used.siteId)}`);
    if (used.categoryId)
      parts.push(`Kategori: ${name(categories, used.categoryId)}`);
    if (used.supplierId)
      parts.push(`Supplier: ${name(suppliers, used.supplierId)}`);
    if (used.q) parts.push(`Cari: ${used.q}`);
    parts.push(
      `Dicetak: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
    );
    return parts.join("  |  ");
  };

  const rows = data?.rows ?? [];
  const cols = data?.columns ?? [];
  const canExport = rows.length > 0 && !pending;

  async function onPdf() {
    try {
      const cut = await exportPdf(cfg.title, subtitle(), cols, rows);
      if (cut)
        toast.info(
          "PDF dibatasi 3.000 baris pertama. Gunakan Excel untuk data lengkap.",
        );
    } catch {
      toast.error("Gagal membuat PDF");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{cfg.title}</h1>
        <p className="text-sm text-muted-foreground">{cfg.desc}</p>
      </div>

      <div className="rounded-md border bg-background p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {has("date") && (
            <>
              <div className="space-y-1">
                <Label>Dari Tanggal</Label>
                <Input
                  type="date"
                  value={f.from ?? ""}
                  onChange={(e) => set({ from: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={f.to ?? ""}
                  onChange={(e) => set({ to: e.target.value })}
                />
              </div>
            </>
          )}
          {has("site") && (
            <div className="space-y-1">
              <Label>Site</Label>
              <select
                className={selectClass}
                value={f.siteId ?? ""}
                onChange={(e) => set({ siteId: e.target.value })}
              >
                <option value="">Semua</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {has("category") && (
            <div className="space-y-1">
              <Label>Kategori</Label>
              <select
                className={selectClass}
                value={f.categoryId ?? ""}
                onChange={(e) => set({ categoryId: e.target.value })}
              >
                <option value="">Semua</option>
                {categories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {has("supplier") && (
            <div className="space-y-1">
              <Label>Supplier</Label>
              <select
                className={selectClass}
                value={f.supplierId ?? ""}
                onChange={(e) => set({ supplierId: e.target.value })}
              >
                <option value="">Semua</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {has("trxType") && (
            <div className="space-y-1">
              <Label>Jenis Transaksi</Label>
              <select
                className={selectClass}
                value={f.trxType ?? ""}
                onChange={(e) => set({ trxType: e.target.value })}
              >
                <option value="">Semua</option>
                {TRX_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {has("status") && cfg.statusOptions && (
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                className={selectClass}
                value={f.status ?? ""}
                onChange={(e) => set({ status: e.target.value })}
              >
                <option value="">Semua</option>
                {cfg.statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {has("q") && (
            <div className="space-y-1">
              <Label>Cari Barang</Label>
              <Input
                placeholder="Kode atau nama..."
                value={f.q ?? ""}
                onChange={(e) => set({ q: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && run()}
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => run()} disabled={pending}>
            {pending ? "Memuat..." : "Tampilkan"}
          </Button>
          <Button variant="outline" onClick={reset} disabled={pending}>
            Reset
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!canExport}
              onClick={() => exportXlsx(cfg.title, cols, rows)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              disabled={!canExport}
              onClick={() => exportCsv(cfg.title, cols, rows)}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" disabled={!canExport} onClick={onPdf}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {data?.truncated && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Data melebihi 10.000 baris dan dipotong. Persempit filter (misalnya
          periode tanggal) agar laporan lengkap.
        </p>
      )}

      <div className="max-h-[65vh] overflow-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead
                  key={c.key}
                  className={
                    c.type === "number" || c.type === "currency"
                      ? "text-right"
                      : ""
                  }
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, cols.length)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {pending
                    ? "Memuat data..."
                    : "Tidak ada data untuk filter ini"}
                </TableCell>
              </TableRow>
            )}
            {rows.slice(0, SHOW_ROWS).map((r, i) => (
              <TableRow
                key={i}
                className={r.site === "TOTAL" ? "font-bold" : ""}
              >
                {cols.map((c) => (
                  <TableCell
                    key={c.key}
                    className={
                      c.type === "number" || c.type === "currency"
                        ? "text-right"
                        : ""
                    }
                  >
                    {formatCell(r[c.key], c.type)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        {rows.length} baris
        {rows.length > SHOW_ROWS &&
          ` (layar menampilkan ${SHOW_ROWS} pertama, ekspor berisi semua)`}
      </p>
    </div>
  );
}
