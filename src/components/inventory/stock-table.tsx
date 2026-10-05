"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export type StockRow = {
  product_id: string;
  code: string;
  product_name: string;
  category: string | null;
  site_id: string;
  site_name: string;
  quantity: number;
  minimum_stock: number;
  status: "SAFE" | "LOW_STOCK" | "OUT_OF_STOCK";
};

const STATUS = {
  SAFE: { label: "Aman", variant: "default" as const },
  LOW_STOCK: { label: "Stok Menipis", variant: "outline" as const },
  OUT_OF_STOCK: { label: "Habis", variant: "destructive" as const },
};

const PAGE_SIZE = 25;
const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export function StockTable({
  rows, sites,
}: {
  rows: StockRow[];
  sites: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [site, setSite] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!site || r.site_id === site) &&
        (!status || r.status === status) &&
        (!s || `${r.code} ${r.product_name} ${r.category ?? ""}`.toLowerCase().includes(s))
    );
  }, [rows, q, site, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari kode / nama / kategori..." value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <select className={selectClass} value={site} onChange={(e) => { setSite(e.target.value); setPage(1); }}>
          <option value="">Semua Site</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua Status</option>
          <option value="SAFE">Aman</option>
          <option value="LOW_STOCK">Stok Menipis</option>
          <option value="OUT_OF_STOCK">Habis</option>
        </select>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Minimum</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Belum ada data stok
                </TableCell>
              </TableRow>
            )}
            {visible.map((r) => (
              <TableRow key={`${r.product_id}|${r.site_id}`}>
                <TableCell>{r.code}</TableCell>
                <TableCell>
                  <Link href={`/inventory/products/${r.product_id}`} className="font-medium hover:underline">
                    {r.product_name}
                  </Link>
                </TableCell>
                <TableCell>{r.category ?? "-"}</TableCell>
                <TableCell>{r.site_name}</TableCell>
                <TableCell className="text-right">{Number(r.quantity)}</TableCell>
                <TableCell className="text-right">{Number(r.minimum_stock)}</TableCell>
                <TableCell><Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} baris</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Sebelumnya</Button>
          <span>{current} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>Berikutnya</Button>
        </div>
      </div>
    </div>
  );
}