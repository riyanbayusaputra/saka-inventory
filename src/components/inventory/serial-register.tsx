"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerSerials } from "@/lib/actions/serials";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SerialRegister({
  products, sites,
}: {
  products: { id: string; name: string }[];
  sites: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const count = text.split(/[\n\r,;\t]+/).map((s) => s.trim()).filter(Boolean).length;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await registerSerials(productId, siteId, text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.count} SN berhasil didaftarkan`);
      setText("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daftarkan SN untuk Stok yang Sudah Ada</CardTitle>
        <CardDescription>
          Untuk router yang sudah tercatat jumlahnya (misalnya dari import) tetapi belum punya SN. Tidak mengubah jumlah stok.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Barang</Label>
              <select className={selectClass} value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">-- Pilih --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Site</Label>
              <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
                <option value="">-- Pilih --</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nomor SN ({count} unit) — satu per baris</Label>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" required />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Daftarkan SN"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}