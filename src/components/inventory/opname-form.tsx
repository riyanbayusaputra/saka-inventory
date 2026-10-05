"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveOpname } from "@/lib/actions/opname";
import type { FormProduct, FormSite } from "@/lib/form-data";

type Initial = {
  id: string;
  opname_date: string;
  site_id: string;
  notes: string | null;
  items: { product_id: string; physical_stock: number; reason: string | null }[];
};

type Row = { key: number; q: string; physical: string; reason: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OpnameForm({
  products, sites, balances, today, initial,
}: {
  products: FormProduct[];
  sites: FormSite[];
  balances: Record<string, number>;
  today: string;
  initial?: Initial;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const label = (p: FormProduct) => `${p.code} - ${p.name}`;
  const byLabel = new Map(products.map((p) => [label(p), p]));
  const byId = new Map(products.map((p) => [p.id, p]));

  const [date, setDate] = useState(initial?.opname_date ?? today);
  const [siteId, setSiteId] = useState(initial?.site_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((it, i) => {
          const p = byId.get(it.product_id);
          return {
            key: i + 1,
            q: p ? label(p) : "",
            physical: String(it.physical_stock),
            reason: it.reason ?? "",
          };
        })
      : [{ key: 1, q: "", physical: "", reason: "" }]
  );

  function patch(key: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  const systemOf = (r: Row) => {
    const p = byLabel.get(r.q.trim());
    return p && siteId ? balances[`${p.id}|${siteId}`] ?? 0 : null;
  };

  function loadAll() {
    if (!siteId) return toast.error("Pilih site terlebih dahulu");
    const have = new Set(rows.map((r) => r.q.trim()));
    const add = products
      .filter((p) => (balances[`${p.id}|${siteId}`] ?? 0) > 0 && !have.has(label(p)))
      .map((p, i) => ({ key: Date.now() + i, q: label(p), physical: "", reason: "" }));
    if (!add.length) return toast.info("Semua barang di site ini sudah ada di daftar");
    setRows((rs) => [...rs.filter((r) => r.q.trim() !== "" || r.physical !== ""), ...add]);
    toast.success(`${add.length} barang ditambahkan. Isi stok fisik hasil hitungan.`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return toast.error("Pilih site");

    const items: { product_id: string; physical_stock: number; reason: string | null }[] = [];
    for (const [i, r] of rows.entries()) {
      if (r.q.trim() === "" && r.physical === "") continue;
      const p = byLabel.get(r.q.trim());
      if (!p) return toast.error(`Baris ${i + 1}: pilih barang dari daftar saran`);
      if (r.physical === "") continue; // belum dihitung → tidak disimpan
      const phys = Number(r.physical);
      if (!(phys >= 0)) return toast.error(`Baris ${i + 1}: stok fisik tidak valid`);
      const diff = phys - (balances[`${p.id}|${siteId}`] ?? 0);
      if (diff !== 0 && !r.reason.trim()) return toast.error(`Baris ${i + 1}: alasan wajib diisi karena ada selisih`);
      items.push({ product_id: p.id, physical_stock: phys, reason: r.reason.trim() || null });
    }
    if (!items.length) return toast.error("Isi stok fisik minimal pada satu barang");

    start(() => {
      void (async () => {
        const res = await saveOpname(
          initial?.id ?? null,
          { opname_date: date, site_id: siteId, notes: notes.trim() || null },
          items
        );
        if (res.error) return toast.error(res.error);
        toast.success("Stock opname tersimpan sebagai Draft");
        router.push(`/inventory/opname/${res.id}`);
      })();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{initial ? "Edit Stock Opname" : "Stock Opname Baru"}</h1>
        <p className="text-sm text-muted-foreground">Bandingkan stok sistem dengan hasil hitung fisik di satu site.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Data Opname</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Tanggal Hitung</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Site</Label>
            <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              <option value="">-- Pilih --</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasil Hitung</CardTitle>
          <CardDescription>
            Baris yang stok fisiknya dikosongkan dianggap belum dihitung dan tidak disimpan. Jika barang memang tidak ada,
            isi 0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <datalist id="opname-products">
            {products.map((p) => <option key={p.id} value={label(p)} />)}
          </datalist>

          <div className="hidden gap-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[1.6fr_90px_110px_90px_1.2fr_40px]">
            <span>Barang</span><span className="text-right">Sistem</span><span>Fisik</span>
            <span className="text-right">Selisih</span><span>Alasan (wajib jika selisih)</span><span />
          </div>

          {rows.map((r) => {
            const sys = systemOf(r);
            const diff = sys !== null && r.physical !== "" ? Number(r.physical) - sys : null;
            return (
              <div
                key={r.key}
                className="grid items-center gap-2 rounded-md border p-2 lg:grid-cols-[1.6fr_90px_110px_90px_1.2fr_40px] lg:border-0 lg:p-0"
              >
                <Input list="opname-products" placeholder="Ketik kode atau nama..." value={r.q} onChange={(e) => patch(r.key, { q: e.target.value })} />
                <div className="text-sm lg:text-right">
                  <span className="lg:hidden text-muted-foreground">Sistem: </span>{sys ?? "-"}
                </div>
                <Input type="number" min="0" step="any" placeholder="Fisik" value={r.physical} onChange={(e) => patch(r.key, { physical: e.target.value })} />
                <div className={`text-sm font-medium lg:text-right ${diff === null || diff === 0 ? "" : diff < 0 ? "text-red-600" : "text-green-700"}`}>
                  <span className="lg:hidden font-normal text-muted-foreground">Selisih: </span>
                  {diff === null ? "-" : diff > 0 ? `+${diff}` : diff}
                </div>
                <Input placeholder="Contoh: barang rusak / salah catat" value={r.reason} onChange={(e) => patch(r.key, { reason: e.target.value })} />
                <Button
                  type="button" variant="ghost" size="icon" disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm"
              onClick={() => setRows((rs) => [...rs, { key: Date.now(), q: "", physical: "", reason: "" }])}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Barang
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadAll}>
              <ListPlus className="mr-2 h-4 w-4" /> Muat Semua Barang di Site Ini
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Draft"}</Button>
      </div>
    </form>
  );
}