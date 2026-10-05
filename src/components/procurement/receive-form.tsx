"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { receivePO } from "@/lib/actions/po";

export type ReceiveLine = {
  product_id: string; name: string; unit: string | null; remaining: number;
};

export function ReceiveForm({
  poId, lines, sites, defaultSiteId, today,
}: {
  poId: string;
  lines: ReceiveLine[];
  sites: { id: string; name: string }[];
  defaultSiteId: string | null;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [siteId, setSiteId] = useState(defaultSiteId ?? "");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.product_id, String(l.remaining)]))
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await receivePO({
        poId, siteId, date,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: Number(qty[l.product_id]) || 0 })),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Penerimaan ${res.number ?? ""} tersimpan, stok bertambah`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Penerimaan Barang</CardTitle>
        <CardDescription>
          Isi qty yang benar-benar datang. Kosongkan (0) untuk barang yang belum diterima. Hasilnya tercatat sebagai Stock In.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tanggal Terima</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Masuk ke Site</Label>
              <select
                value={siteId} onChange={(e) => setSiteId(e.target.value)} required
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">-- Pilih --</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.product_id} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_140px]">
                <span className="text-sm font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">Sisa: {l.remaining} {l.unit ?? ""}</span>
                <Input
                  type="number" min="0" max={l.remaining} step="any"
                  value={qty[l.product_id] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [l.product_id]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Keterangan (mis. nomor surat jalan)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Terima Barang"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}