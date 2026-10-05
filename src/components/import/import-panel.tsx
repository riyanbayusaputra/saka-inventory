"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  importProducts, importOpeningBalance, type ImportReport, type RowStatus,
} from "@/lib/actions/import";

type Mode = "products" | "balance";

const CONFIG = {
  products: {
    title: "Import Master Barang",
    desc: "Isi daftar barang. Barang yang namanya sudah ada akan dilewati.",
    filename: "template-master-barang.xlsx",
    headers: ["Nama Barang", "Kategori", "Satuan", "Kondisi", "Minimum Stok", "Harga Beli", "Merk", "Spesifikasi", "Supplier", "Keterangan"],
    example: ["Kabel Precon 150m", "Kabel", "Roll", "NEW", 10, 100000, "", "Kabel Precon 150m", "", ""],
    run: importProducts,
  },
  balance: {
    title: "Import Saldo Awal",
    desc: "Isi stok saat ini per site. Dicatat sebagai transaksi Stock In 'Saldo awal'. Impor master barang lebih dulu.",
    filename: "template-saldo-awal.xlsx",
    headers: ["Nama Barang", "Site", "Qty", "Harga"],
    example: ["Kabel Precon 150m", "Gudang Pusat", 7, 100000],
    run: importOpeningBalance,
  },
} as const;

const statusUi: Record<RowStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ok: { label: "Siap", variant: "default" },
  warn: { label: "Catatan", variant: "outline" },
  skip: { label: "Dilewati", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

type Rows = Record<string, unknown>[];

function ImportPanel({ mode }: { mode: Mode }) {
  const cfg = CONFIG[mode];
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState("");
  const [rows, setRows] = useState<Rows>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([[...cfg.headers], [...cfg.example]]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, ws, "Data");
    XLSX.writeFile(book, cfg.filename);
  }

  function preview(book: XLSX.WorkBook, name: string) {
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name], { defval: "" });
    setRows(data);
    setReport(null);
    start(async () => setReport(await cfg.run(data, false)));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const first = book.SheetNames[0];
      setWb(book);
      setSheet(first);
      preview(book, first);
    } catch {
      toast.error("File tidak bisa dibaca");
    }
    e.target.value = "";
  }

  function onCommit() {
    start(async () => {
      const res = await cfg.run(rows, true);
      setReport(res);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${res.importable} baris berhasil diimport`);
        setRows([]);
      }
    });
  }

  const canCommit = report && !report.committed && !report.error && report.importable > 0 && rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cfg.title}</CardTitle>
        <CardDescription>{cfg.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Unduh Template
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="mr-2 h-4 w-4" /> Pilih File
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          </label>
          {wb && wb.SheetNames.length > 1 && (
            <select
              value={sheet}
              onChange={(e) => { setSheet(e.target.value); preview(wb, e.target.value); }}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {wb.SheetNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          )}
        </div>

        {pending && !report && <p className="text-sm text-muted-foreground">Memeriksa data...</p>}

        {report?.error && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{report.error}</p>
        )}

        {report && report.results.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge>{report.importable} siap</Badge>
              <Badge variant="secondary">{report.skipped} dilewati</Badge>
              <Badge variant="destructive">{report.errors} error</Badge>
              {report.committed && <span className="font-medium text-green-700">✔ Import selesai</span>}
              {canCommit && (
                <Button className="ml-auto" disabled={pending} onClick={onCommit}>
                  {pending ? "Mengimport..." : `Import ${report.importable} baris`}
                </Button>
              )}
            </div>

            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Baris</TableHead>
                    <TableHead>Barang</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.results.slice(0, 300).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.line}</TableCell>
                      <TableCell>{r.label}</TableCell>
                      <TableCell><Badge variant={statusUi[r.status].variant}>{statusUi[r.status].label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {report.results.length > 300 && (
              <p className="text-xs text-muted-foreground">Menampilkan 300 baris pertama dari {report.results.length}.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ImportTabs() {
  const [mode, setMode] = useState<Mode>("products");
  const tab = (m: Mode, label: string) => (
    <Button variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{label}</Button>
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tab("products", "1. Master Barang")}
        {tab("balance", "2. Saldo Awal")}
      </div>
      <ImportPanel key={mode} mode={mode} />
    </div>
  );
}