"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SerialInput } from "@/components/inventory/serial-input";
import { submitTransaction } from "@/lib/actions/transactions";
import { lookupSerial } from "@/lib/actions/serials";
import type { FormProduct, FormSite } from "@/lib/form-data";

type Type = "IN" | "OUT" | "TRANSFER";

const TEXT: Record<Type, { title: string; desc: string }> = {
  IN: { title: "Stock In", desc: "Catat barang masuk ke sebuah site." },
  OUT: { title: "Stock Out", desc: "Catat barang keluar dari sebuah site." },
  TRANSFER: { title: "Transfer Barang", desc: "Pindahkan barang dari satu site ke site lain." },
};

type Row = { key: number; q: string; qty: string; price: string; sn: string[] };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyRow = (key: number): Row => ({ key, q: "", qty: "", price: "", sn: [] });

export function TransactionForm({
  type, products, sites, balances, serials, today,
}: {
  type: Type;
  products: FormProduct[];
  sites: FormSite[];
  balances: Record<string, number>;
  serials: Record<string, string[]>;
  today: string;
}) {
  const [date, setDate] = useState(today);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [requester, setRequester] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(1)]);
  const [pending, start] = useTransition();

  const label = (p: FormProduct) => `${p.code} - ${p.name}${p.pon_type ? ` [${p.pon_type}]` : ""}`;
  const byLabel = new Map(products.map((p) => [label(p), p]));

  const needSource = type === "OUT" || type === "TRANSFER";
  const needDest = type === "IN" || type === "TRANSFER";

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onProductChange(key: number, value: string) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const before = byLabel.get(r.q.trim())?.id;
        const after = byLabel.get(value.trim())?.id;
        // ganti barang: daftar SN lama tidak berlaku lagi
        return { ...r, q: value, sn: before && after && before !== after ? [] : r.sn };
      })
    );
  }

  function reset() {
    setRows([emptyRow(Date.now())]);
    setRequester(""); setPurpose(""); setNotes("");
  }

  // pengecekan instan tiap SN yang di-scan
  async function checkSn(sn: string, p: FormProduct): Promise<string | null> {
    const res = await lookupSerial(sn);
    if (!res.found) return null;
    if (res.product_id !== p.id) return `sudah terdaftar untuk barang lain (${res.product_name})`;
    if (type === "IN") {
      return res.status === "IN_STOCK" ? `sudah ada di stok (${res.site_name ?? "-"})` : null;
    }
    if (res.status !== "IN_STOCK" || res.site_id !== sourceId) {
      return res.status === "OUT"
        ? "sudah keluar, tidak ada di stok"
        : `ada di ${res.site_name ?? "site lain"}, bukan di site asal`;
    }
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const items: { product_id: string; quantity: number; unit_price: number; serials?: string[] }[] = [];
    for (const [i, r] of rows.entries()) {
      const p = byLabel.get(r.q.trim());
      if (!p) return toast.error(`Baris ${i + 1}: pilih barang dari daftar saran`);

      if (p.track_serial) {
        if (!r.sn.length) return toast.error(`Baris ${i + 1}: isi nomor SN untuk ${p.name}`);
        items.push({ product_id: p.id, quantity: r.sn.length, unit_price: Number(r.price) || 0, serials: r.sn });
      } else {
        const qty = Number(r.qty);
        if (!(qty > 0)) return toast.error(`Baris ${i + 1}: qty harus lebih dari 0`);
        items.push({ product_id: p.id, quantity: qty, unit_price: Number(r.price) || 0 });
      }
    }

    start(async () => {
      const res = await submitTransaction({
        type, date,
        sourceId: needSource ? sourceId || null : null,
        destId: needDest ? destId || null : null,
        requester: requester.trim() || null,
        purpose: purpose.trim() || null,
        notes: notes.trim() || null,
        items,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Transaksi ${res.number ?? ""} tersimpan`);
        reset();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{TEXT[type].title}</h1>
        <p className="text-sm text-muted-foreground">{TEXT[type].desc}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Transaksi</CardTitle>
          <CardDescription>Nomor transaksi dibuat otomatis.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              {needSource && (
                <div className="space-y-2">
                  <Label>Site Asal</Label>
                  <select className={selectClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)} required>
                    <option value="">-- Pilih --</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {needDest && (
                <div className="space-y-2">
                  <Label>{type === "IN" ? "Site Tujuan" : "Ke Site"}</Label>
                  <select className={selectClass} value={destId} onChange={(e) => setDestId(e.target.value)} required>
                    <option value="">-- Pilih --</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {type === "OUT" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pemakai / Pelanggan</Label>
                  <Input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Nama teknisi atau pelanggan" />
                </div>
                <div className="space-y-2">
                  <Label>Keperluan</Label>
                  <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Contoh: Pemasangan baru" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Barang</Label>
              <datalist id="product-list">
                {products.map((p) => <option key={p.id} value={label(p)} />)}
              </datalist>

              <div className="space-y-3">
                {rows.map((r) => {
                  const p = byLabel.get(r.q.trim());
                  const tracked = !!p?.track_serial;
                  const key = p && sourceId ? `${p.id}|${sourceId}` : "";
                  const available = needSource && p && sourceId ? balances[key] ?? 0 : null;
                  const avail = tracked && needSource && key ? serials[key] ?? [] : [];
                  const noSn = tracked && available !== null ? Math.max(0, available - avail.length) : 0;

                  return (
                    <div key={r.key} className="space-y-2">
                      <div className="grid items-start gap-2 sm:grid-cols-[1fr_110px_150px_auto]">
                        <div>
                          <Input
                            list="product-list"
                            placeholder="Ketik kode atau nama barang..."
                            value={r.q}
                            onChange={(e) => onProductChange(r.key, e.target.value)}
                            required
                          />
                          {available !== null && (
                            <p className={`mt-1 text-xs ${available <= 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              Stok tersedia: {available} {p?.unit ?? ""}
                            </p>
                          )}
                          {tracked && <p className="mt-1 text-xs text-blue-700">Barang ini dilacak per nomor SN</p>}
                        </div>
                        {tracked ? (
                          <Input value={String(r.sn.length)} readOnly className="bg-muted" title="Mengikuti jumlah SN" />
                        ) : (
                          <Input
                            type="number" min="0" step="any" placeholder="Qty"
                            value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} required
                          />
                        )}
                        {type === "IN" ? (
                          <Input
                            type="number" min="0" step="any" placeholder="Harga satuan (Rp)"
                            value={r.price} onChange={(e) => update(r.key, { price: e.target.value })}
                          />
                        ) : <div className="hidden sm:block" />}
                        <Button
                          type="button" variant="ghost" size="icon"
                          disabled={rows.length === 1}
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {tracked && p && (
                        <div className="space-y-2 rounded-md bg-muted/40 p-3">
                          <Label className="text-xs">
                            Nomor SN — scan barcode, ketik lalu Enter, atau tempel banyak sekaligus
                          </Label>
                          <SerialInput
                            value={r.sn}
                            setList={(fn) =>
                              setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, sn: fn(x.sn) } : x)))
                            }
                            check={(sn) => checkSn(sn, p)}
                            suggestions={avail}
                            disabledReason={needSource && !sourceId ? "Pilih site asal dulu" : undefined}
                          />
                          {noSn > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Stok tanpa SN: {noSn}. Scan SN barunya, otomatis terdaftar.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setRows((rs) => [...rs, emptyRow(Date.now())])}
              >
                <Plus className="mr-2 h-4 w-4" /> Tambah Barang
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Transaksi"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}