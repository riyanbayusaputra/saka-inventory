"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { importAssets } from "@/lib/actions/assets";
import { parseAssetWorkbook, type ParsedAssets } from "@/lib/asset-parser";
import { rupiah } from "@/lib/format";

export function AssetImport({
  open, onOpenChange, locationSuggestions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  locationSuggestions: string[];
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedAssets | null>(null);
  const [fileName, setFileName] = useState("");
  const [defaultLoc, setDefaultLoc] = useState("");
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setReading(true);
    setParsed(null);
    try {
      setParsed(await parseAssetWorkbook(file));
      setFileName(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "File tidak bisa dibaca");
    } finally {
      setReading(false);
      input.value = "";
    }
  }

  function onImport() {
    if (!parsed) return;
    const loc = defaultLoc.trim();
    const rows = parsed.rows.map((r) => ({ ...r, location: r.location ?? (loc || null) }));
    start(async () => {
      const res = await importAssets(rows);
      if (res.error) return void toast.error(res.error);
      toast.success(
        `${res.inserted} aset ditambahkan, ${res.duplicates} dilewati (sudah ada)` +
          (res.invalid ? `, ${res.invalid} tidak valid` : "")
      );
      setParsed(null);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setParsed(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Aset dari Excel</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Upload file Excel dengan kolom NO, TANGGAL, JENIS, NAMA/MERK, NOMOR/SERI, QTY, HARGA, ANGSURAN, DESKRIPSI
          (kolom LOKASI opsional). Aset yang sama persis (jenis, nama, seri, tanggal) dilewati, jadi aman diulang.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="mr-2 h-4 w-4" /> Pilih File Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
          </label>
          {fileName && parsed && <span className="text-sm text-muted-foreground">{fileName}</span>}
          {reading && <span className="text-sm text-muted-foreground">Membaca file...</span>}
        </div>

        {parsed && (
          <>
            <div className="space-y-1">
              <Label>Lokasi untuk semua baris yang kolom Lokasinya kosong (opsional)</Label>
              <Input
                list="asset-import-locs"
                value={defaultLoc}
                onChange={(e) => setDefaultLoc(e.target.value)}
                placeholder="Contoh: Kantor Pusat"
              />
              <datalist id="asset-import-locs">
                {locationSuggestions.map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>

            <p className="text-sm">
              Sheet <b>{parsed.sheet}</b>: <b>{parsed.rows.length}</b> baris siap diimport
              {parsed.skipped.length > 0 && <>, {parsed.skipped.length} dilewati</>}.
            </p>

            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Nama/Merk</TableHead>
                    <TableHead>Nomor/Seri</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Angsuran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{r.acquired_date ?? "-"}</TableCell>
                      <TableCell>{r.asset_type}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.model_serial ?? "-"}</TableCell>
                      <TableCell className="text-right">{r.qty}</TableCell>
                      <TableCell className="text-right">{rupiah(r.price)}</TableCell>
                      <TableCell className="text-right">{rupiah(r.installment)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.rows.length > 50 && (
              <p className="text-xs text-muted-foreground">Menampilkan 50 baris pertama dari {parsed.rows.length}.</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button disabled={pending || parsed.rows.length === 0} onClick={onImport}>
                {pending ? "Mengimport..." : `Import ${parsed.rows.length} baris`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}