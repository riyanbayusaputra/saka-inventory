"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoItemInput, savePO } from "@/lib/actions/po";
import { rupiah } from "@/lib/format";

export interface PoProduct {
  id: string;
  code: string;
  name: string;
  default_price: number;
  specification: string | null;
}

export interface InitialItem {
  product_id: string;
  section: string | null;
  specification: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
}

type Initial = {
  id: string;
  po_date: string;
  supplier_id: string | null;
  site_id: string | null;
  area: string | null;
  route: string | null;
  principal: string | null;
  notes: string | null;
  items: InitialItem[];
};

export interface SupplierOption {
  id: string;
  name: string;
}

export interface SiteOption {
  id: string;
  name: string;
}

export interface Row {
  key: number;
  q: string;
  section: string;
  spec: string;
  qty: string;
  price: string;
  discount: string;
}

export interface PoFormProps {
  products: PoProduct[];
  suppliers: SupplierOption[];
  sites: SiteOption[];
  today: string;
  initial?: Initial;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PoForm({
  products,
  suppliers,
  sites,
  today,
  initial,
}: PoFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const label = (p: PoProduct) => `${p.code} - ${p.name}`;
  const byLabel = new Map(products.map((p) => [label(p), p]));
  const byId = new Map(products.map((p) => [p.id, p]));

  const [date, setDate] = useState(initial?.po_date ?? today);
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [siteId, setSiteId] = useState(initial?.site_id ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [route, setRoute] = useState(initial?.route ?? "");
  const [principal, setPrincipal] = useState(
    initial?.principal ?? "PT SAKA MEDIA KOMUNIKA",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [rows, setRows] = useState<Row[]>(
    initial?.items.length
      ? initial.items.map((it, i) => {
          const p = byId.get(it.product_id);
          return {
            key: i + 1,
            q: p ? label(p) : "",
            section: it.section ?? "",
            spec: it.specification ?? "",
            qty: String(it.quantity),
            price: String(it.unit_price),
            discount: it.discount ? String(it.discount) : "",
          };
        })
      : [
          {
            key: 1,
            q: "",
            section: "",
            spec: "",
            qty: "",
            price: "",
            discount: "",
          },
        ],
  );

  function patch(key: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  function onProductChange(key: number, value: string) {
    const p = byLabel.get(value.trim());
    setRows((rs) =>
      rs.map((r) =>
        r.key !== key
          ? r
          : {
              ...r,
              q: value,
              // isi otomatis harga & spesifikasi hanya jika masih kosong
              price:
                p && r.price === "" ? String(p.default_price || "") : r.price,
              spec: p && r.spec === "" ? (p.specification ?? "") : r.spec,
            },
      ),
    );
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      {
        key: Date.now(),
        q: "",
        section: rs[rs.length - 1]?.section ?? "",
        spec: "",
        qty: "",
        price: "",
        discount: "",
      },
    ]);
  }

  const subtotal = (r: Row) =>
    Math.max(
      0,
      (Number(r.qty) || 0) * (Number(r.price) || 0) - (Number(r.discount) || 0),
    );
  const total = rows.reduce((s, r) => s + subtotal(r), 0);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items: PoItemInput[] = [];
    for (const [i, r] of rows.entries()) {
      const p = byLabel.get(r.q.trim());
      if (!p)
        return toast.error(`Baris ${i + 1}: pilih barang dari daftar saran`);
      items.push({
        product_id: p.id,
        section: r.section.trim() || null,
        specification: r.spec.trim() || null,
        quantity: Number(r.qty),
        unit_price: Number(r.price) || 0,
        discount: Number(r.discount) || 0,
      });
    }
    start(async () => {
      const res = await savePO(
        initial?.id ?? null,
        {
          po_date: date,
          supplier_id: supplierId || null,
          site_id: siteId || null,
          area: area.trim() || null,
          route: route.trim() || null,
          principal: principal.trim() || null,
          notes: notes.trim() || null,
        },
        items,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("PO tersimpan");
      router.push(`/procurement/purchase-orders/${res.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {initial ? "Edit Purchase Order" : "Purchase Order Baru"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {initial
            ? "PO Draft dapat diubah sebelum diajukan."
            : "PO disimpan sebagai Draft. Nomor PO dibuat otomatis."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data PO</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <select
              className={selectClass}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">-- Pilih --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Site Tujuan Penerimaan</Label>
            <select
              className={selectClass}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">-- Pilih --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Contoh: GONDANG"
            />
          </div>
          <div className="space-y-2">
            <Label>P. Rute</Label>
            <Input value={route} onChange={(e) => setRoute(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Principal</Label>
            <Input
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label>Keterangan</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Barang yang Dipesan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <datalist id="po-products">
            {products.map((p) => (
              <option key={p.id} value={label(p)} />
            ))}
          </datalist>

          <div className="hidden gap-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[150px_1.4fr_1fr_80px_120px_110px_110px_40px]">
            <span>Bagian</span>
            <span>Barang</span>
            <span>Spesifikasi</span>
            <span>Qty</span>
            <span>Harga</span>
            <span>Diskon</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>

          {rows.map((r) => (
            <div
              key={r.key}
              className="grid items-start gap-2 rounded-md border p-2 lg:grid-cols-[150px_1.4fr_1fr_80px_120px_110px_110px_40px] lg:border-0 lg:p-0"
            >
              <Input
                placeholder="Bagian (mis. A. Perangkat)"
                value={r.section}
                onChange={(e) => patch(r.key, { section: e.target.value })}
              />
              <Input
                list="po-products"
                placeholder="Ketik kode atau nama..."
                value={r.q}
                onChange={(e) => onProductChange(r.key, e.target.value)}
                required
              />
              <Input
                placeholder="Spesifikasi"
                value={r.spec}
                onChange={(e) => patch(r.key, { spec: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={r.qty}
                onChange={(e) => patch(r.key, { qty: e.target.value })}
                required
              />
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Harga"
                value={r.price}
                onChange={(e) => patch(r.key, { price: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Diskon"
                value={r.discount}
                onChange={(e) => patch(r.key, { discount: e.target.value })}
              />
              <div className="flex h-9 items-center justify-end text-sm font-medium">
                {rupiah(subtotal(r))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((rs) => rs.filter((x) => x.key !== r.key))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Barang
            </Button>
            <p className="text-lg font-bold">Total: {rupiah(total)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan PO"}
        </Button>
      </div>
    </form>
  );
}
