"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AssetImport } from "@/components/assets/asset-import";
import { deleteAsset, saveAsset, toggleAsset, type AssetInput } from "@/lib/actions/assets";
import { exportXlsx } from "@/lib/export";
import { number, rupiah } from "@/lib/format";
import type { Col, Row } from "@/lib/reports";

export type Asset = {
  id: string;
  code: string;
  acquired_date: string | null;
  asset_type: string;
  name: string;
  model_serial: string | null;
  qty: number;
  price: number;
  installment: number;
  description: string | null;
  location: string | null;
  is_active: boolean;
};

const PAGE_SIZE = 20;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BASE_TYPES = ["KENDARAAN BERJALAN", "PERANGKAT PENDUKUNG"];
const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export function AssetManager({
  rows, siteNames, canEdit,
}: {
  rows: Asset[];
  siteNames: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loc, setLoc] = useState("");
  const [status, setStatus] = useState<"active" | "all" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const types = useMemo(() => [...new Set(rows.map((r) => r.asset_type))].sort(), [rows]);
  const typeSuggestions = useMemo(() => [...new Set([...BASE_TYPES, ...types])], [types]);
  const locations = useMemo(
    () => [...new Set(rows.map((r) => r.location).filter(Boolean) as string[])].sort(),
    [rows]
  );
  const locSuggestions = useMemo(() => [...new Set([...siteNames, ...locations])].sort(), [siteNames, locations]);
  const descriptions = useMemo(
    () => [...new Set(rows.map((r) => r.description).filter(Boolean) as string[])].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === "all" || (status === "active") === r.is_active) &&
        (!type || r.asset_type === type) &&
        (!loc || (loc === "__none" ? !r.location : r.location === loc)) &&
        (!s ||
          `${r.code} ${r.asset_type} ${r.name} ${r.model_serial ?? ""} ${r.description ?? ""} ${r.location ?? ""}`
            .toLowerCase()
            .includes(s))
    );
  }, [rows, q, type, loc, status]);

  const live = filtered.filter((r) => r.is_active);
  const totalUnits = live.reduce((s, r) => s + r.qty, 0);
  const totalValue = live.reduce((s, r) => s + r.price, 0);
  const totalInstallment = live.reduce((s, r) => s + r.installment, 0);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function openForm(a: Asset | null) {
    setEditing(a);
    setFormOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const input: AssetInput = {
      acquired_date: g("acquired_date") || null,
      asset_type: g("asset_type"),
      name: g("name"),
      model_serial: g("model_serial") || null,
      qty: Number(g("qty") || 0),
      price: Number(g("price") || 0),
      installment: Number(g("installment") || 0),
      description: g("description") || null,
      location: g("location") || null,
    };
    start(async () => {
      const res = await saveAsset(editing?.id ?? null, input);
      if (res.error) return void toast.error(res.error);
      toast.success(editing ? "Aset diperbarui" : "Aset ditambahkan");
      setFormOpen(false);
      router.refresh();
    });
  }

  function onToggle(a: Asset) {
    start(async () => {
      const res = await toggleAsset(a.id, !a.is_active);
      if (res.error) return void toast.error(res.error);
      toast.success(a.is_active ? "Aset dinonaktifkan" : "Aset diaktifkan");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const a = deleting;
    start(async () => {
      const res = await deleteAsset(a.id);
      setDeleting(null);
      if (res.error) return void toast.error(res.error);
      toast.success("Aset dihapus");
      router.refresh();
    });
  }

  function onExport() {
    const cols: Col[] = [
      { key: "no", label: "No", type: "number" },
      { key: "date", label: "Tanggal" },
      { key: "type", label: "Jenis" },
      { key: "name", label: "Nama/Merk" },
      { key: "model", label: "Nomor/Seri" },
      { key: "qty", label: "Qty", type: "number" },
      { key: "price", label: "Harga", type: "currency" },
      { key: "installment", label: "Angsuran", type: "currency" },
      { key: "desc", label: "Deskripsi" },
      { key: "location", label: "Lokasi" },
      { key: "status", label: "Status" },
    ];
    const data: Row[] = filtered.map((r, i) => ({
      no: i + 1, date: r.acquired_date, type: r.asset_type, name: r.name, model: r.model_serial,
      qty: r.qty, price: r.price, installment: r.installment, desc: r.description,
      location: r.location, status: r.is_active ? "Aktif" : "Nonaktif",
    }));
    exportXlsx("Data Aset dan Inventaris", cols, data);
  }

  const stat = (label: string, value: string) => (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Aset &amp; Inventaris</h1>
          <p className="text-sm text-muted-foreground">Data aset dan inventaris PT Saka Media Komunika.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={filtered.length === 0} onClick={onExport}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Ekspor Excel
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Import Excel
              </Button>
              <Button onClick={() => openForm(null)}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Aset
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Jumlah Aset", number(live.length))}
        {stat("Total Unit", number(totalUnits))}
        {stat("Total Nilai", rupiah(totalValue))}
        {stat("Total Angsuran / Bulan", rupiah(totalInstallment))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Cari nama, seri, lokasi..." value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <select className={selectClass} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">Semua jenis</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={selectClass} value={loc} onChange={(e) => { setLoc(e.target.value); setPage(1); }}>
          <option value="">Semua lokasi</option>
          <option value="__none">(Belum ada lokasi)</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          className={selectClass} value={status}
          onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
        >
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="all">Semua status</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Nama/Merk</TableHead>
              <TableHead>Nomor/Seri</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Angsuran</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-24 text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 12 : 11} className="h-24 text-center text-muted-foreground">
                  Belum ada data aset
                </TableCell>
              </TableRow>
            )}
            {visible.map((r, i) => (
              <TableRow key={r.id} className={r.is_active ? "" : "opacity-50"}>
                <TableCell>{(current - 1) * PAGE_SIZE + i + 1}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(r.acquired_date)}</TableCell>
                <TableCell className="text-xs">{r.asset_type}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.model_serial ?? "-"}</TableCell>
                <TableCell className="text-right">{r.qty}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{rupiah(r.price)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{r.installment ? rupiah(r.installment) : "-"}</TableCell>
                <TableCell>{r.description ?? "-"}</TableCell>
                <TableCell>{r.location ?? "-"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <button disabled={pending} onClick={() => onToggle(r)} title="Klik untuk mengubah status">
                      <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Aktif" : "Nonaktif"}</Badge>
                    </button>
                  ) : (
                    <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openForm(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Hapus" onClick={() => setDeleting(r)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} aset</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Sebelumnya</Button>
          <span>{current} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>Berikutnya</Button>
        </div>
      </div>

      <datalist id="asset-types">{typeSuggestions.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="asset-locs">{locSuggestions.map((l) => <option key={l} value={l} />)}</datalist>
      <datalist id="asset-desc">{descriptions.map((d) => <option key={d} value={d} />)}</datalist>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
          </DialogHeader>
          <form key={editing?.id ?? "new"} onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acquired_date">Tanggal</Label>
              <Input id="acquired_date" name="acquired_date" type="date" defaultValue={editing?.acquired_date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset_type">Jenis <span className="text-red-600">*</span></Label>
              <Input id="asset_type" name="asset_type" list="asset-types" required defaultValue={editing?.asset_type ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nama/Merk <span className="text-red-600">*</span></Label>
              <Input id="name" name="name" required defaultValue={editing?.name ?? ""} placeholder="Contoh: LAPTOP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model_serial">Nomor/Seri</Label>
              <Input id="model_serial" name="model_serial" defaultValue={editing?.model_serial ?? ""} placeholder="Contoh: LAPTOP LENOVO T14" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">Qty</Label>
              <Input id="qty" name="qty" type="number" min="0" step="1" defaultValue={editing?.qty ?? 1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Harga (Rp)</Label>
              <Input id="price" name="price" type="number" min="0" step="any" defaultValue={editing?.price ?? 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment">Angsuran (Rp per bulan)</Label>
              <Input id="installment" name="installment" type="number" min="0" step="any" defaultValue={editing?.installment ?? 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Input id="description" name="description" list="asset-desc" defaultValue={editing?.description ?? ""} placeholder="Contoh: OPERASIONAL" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="location">Lokasi</Label>
              <Input id="location" name="location" list="asset-locs" defaultValue={editing?.location ?? ""} placeholder="Contoh: Kantor Pusat, Site AMK, atau nama pemegang" />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus aset &quot;{deleting?.name}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting?.model_serial ?? ""} dihapus permanen dan tidak bisa dikembalikan (tercatat di Audit Log).
            Kalau asetnya hanya sudah tidak dipakai atau dijual, lebih baik pilih status Nonaktif.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending ? "Menghapus..." : "Hapus"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AssetImport open={importOpen} onOpenChange={setImportOpen} locationSuggestions={locSuggestions} />
    </div>
  );
}