"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { saveRecord, toggleActive, type Values } from "@/lib/actions/master";

export type Row = {
  id: string;
  is_active: boolean;
  [key: string]: string | number | boolean | null;
};

export type Column = {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "boolean";
};

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  required?: boolean;
  full?: boolean; // lebar penuh (2 kolom)
  options?: { value: string; label: string }[];
};

type Props = {
  title: string;
  description?: string;
  table: string;
  rows: Row[];
  columns: Column[];
  fields: Field[];
  searchKeys: string[];
  canEdit: boolean;
};

const PAGE_SIZE = 20;

function fmt(v: string | number | boolean | null | undefined, type?: Column["type"]) {
  if (v === null || v === undefined || v === "") return "-";
  if (type === "currency")
    return new Intl.NumberFormat("id-ID", {
      style: "currency", currency: "IDR", maximumFractionDigits: 0,
    }).format(Number(v));
  if (type === "number") return new Intl.NumberFormat("id-ID").format(Number(v));
  if (type === "boolean") return v ? "Ya" : "Tidak";
  return String(v);
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MasterCrud({
  title, description, table, rows, columns, fields, searchKeys, canEdit,
}: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))
    );
  }, [rows, query, searchKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function openForm(row: Row | null) {
    setEditing(row);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Values = {};
    for (const f of fields) {
      if (f.type === "checkbox") {
        values[f.name] = fd.get(f.name) === "on";
      } else {
        const raw = String(fd.get(f.name) ?? "").trim();
        if (f.type === "number") values[f.name] = raw === "" ? 0 : Number(raw);
        else values[f.name] = raw === "" ? null : raw;
      }
    }
    start(async () => {
      const res = await saveRecord(table, editing?.id ?? null, values);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Data diperbarui" : "Data ditambahkan");
      setOpen(false);
    });
  }

  function onToggle(row: Row) {
    start(async () => {
      const res = await toggleActive(table, row.id, !row.is_active);
      if (res.error) toast.error(res.error);
      else toast.success(row.is_active ? "Dinonaktifkan" : "Diaktifkan");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {canEdit && (
          <Button onClick={() => openForm(null)}>
            <Plus className="mr-2 h-4 w-4" /> Tambah
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari..."
          className="pl-9"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        />
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.type === "currency" || c.type === "number" ? "text-right" : ""}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-24 text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="h-24 text-center text-muted-foreground">
                  Belum ada data
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => (
              <TableRow key={row.id} className={row.is_active ? "" : "opacity-50"}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.type === "currency" || c.type === "number" ? "text-right" : ""}>
                    {fmt(row[c.key], c.type)}
                  </TableCell>
                ))}
                <TableCell>
                  {canEdit ? (
                    <button disabled={pending} onClick={() => onToggle(row)} title="Klik untuk mengubah status">
                      <Badge variant={row.is_active ? "default" : "secondary"}>
                        {row.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant={row.is_active ? "default" : "secondary"}>
                      {row.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openForm(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} data</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Sebelumnya
          </Button>
          <span>{current} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            Berikutnya
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${title}` : `Tambah ${title}`}</DialogTitle>
          </DialogHeader>
          <form key={editing?.id ?? "new"} onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
            {fields.map((f) => {
              const val = editing?.[f.name];
              const wide = f.full || f.type === "textarea";
              return (
                <div key={f.name} className={wide ? "col-span-2 space-y-2" : "space-y-2"}>
                  {f.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={f.name} defaultChecked={Boolean(val)} />
                      {f.label}
                    </label>
                  ) : (
                    <>
                      <Label htmlFor={f.name}>
                        {f.label}{f.required && <span className="text-red-600"> *</span>}
                      </Label>
                      {f.type === "textarea" ? (
                        <Textarea id={f.name} name={f.name} rows={3} defaultValue={val == null ? "" : String(val)} />
                      ) : f.type === "select" ? (
                        <select id={f.name} name={f.name} required={f.required} defaultValue={val == null ? "" : String(val)} className={selectClass}>
                          <option value="">-- Pilih --</option>
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id={f.name}
                          name={f.name}
                          type={f.type === "number" ? "number" : "text"}
                          step={f.type === "number" ? "any" : undefined}
                          min={f.type === "number" ? 0 : undefined}
                          required={f.required}
                          defaultValue={val == null ? "" : String(val)}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}