import * as XLSX from "xlsx";
import type { AssetInput } from "@/lib/actions/assets";

export type ParsedAssets = {
  sheet: string;
  rows: AssetInput[];
  skipped: { line: string; reason: string }[];
};

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8,
  september: 9, oktober: 10, november: 11, desember: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function parseDate(v: unknown): string | null {
  if (typeof v === "number") {
    if (!(v > 20000 && v < 80000)) return null;
    return new Date((Math.floor(v) - 25569) * 86400000).toISOString().slice(0, 10);
  }
  const s = clean(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // contoh: "Jumat, 07 Maret 2025" (awalan nama hari diabaikan)
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function parseMoney(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = clean(v).replace(/rp/gi, "").replace(/\s/g, "");
  if (!s || s === "-") return 0;
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type ColKey = "date" | "type" | "name" | "model" | "qty" | "price" | "installment" | "desc" | "location";

function mapHeader(cell: unknown): ColKey | null {
  const t = clean(cell).toLowerCase();
  if (!t) return null;
  if (t.startsWith("tanggal")) return "date";
  if (t.startsWith("jenis")) return "type";
  if (t.includes("nama") || t.includes("merk")) return "name";
  if (t.includes("seri") || t.includes("nomor")) return "model";
  if (t.startsWith("qty") || t.startsWith("jumlah")) return "qty";
  if (t.startsWith("harga")) return "price";
  if (t.startsWith("angsuran")) return "installment";
  if (t.startsWith("deskripsi") || t.startsWith("keterangan")) return "desc";
  if (t.startsWith("lokasi")) return "location";
  return null;
}

export async function parseAssetWorkbook(file: File): Promise<ParsedAssets> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });

  for (const sheet of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
      header: 1, raw: true, defval: null, blankrows: true,
    });

    let h = -1;
    let cols = new Map<number, ColKey>();
    for (let r = 0; r < Math.min(25, aoa.length); r++) {
      const found = new Map<number, ColKey>();
      (aoa[r] ?? []).forEach((cell, c) => {
        const k = mapHeader(cell);
        if (k && ![...found.values()].includes(k)) found.set(c, k);
      });
      const keys = new Set(found.values());
      if (keys.has("type") && keys.has("name")) {
        h = r;
        cols = found;
        break;
      }
    }
    if (h < 0) continue;

    const rows: AssetInput[] = [];
    const skipped: ParsedAssets["skipped"] = [];

    for (let r = h + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const get = (k: ColKey) => {
        for (const [c, key] of cols) if (key === k) return row[c];
        return null;
      };

      const type = clean(get("type"));
      const name = clean(get("name"));
      if (!type && !name) continue;
      if (!type || !name) {
        skipped.push({ line: `${sheet} baris ${r + 1}`, reason: "Jenis atau nama kosong" });
        continue;
      }

      const qtyRaw = get("qty");
      const qtyNum = qtyRaw === null || clean(qtyRaw) === "" ? 1 : Math.round(parseMoney(qtyRaw));

      rows.push({
        acquired_date: parseDate(get("date")),
        asset_type: type,
        name,
        model_serial: clean(get("model")) || null,
        qty: qtyNum,
        price: parseMoney(get("price")),
        installment: parseMoney(get("installment")),
        description: clean(get("desc")) || null,
        location: clean(get("location")) || null,
      });
    }

    return { sheet, rows, skipped };
  }

  throw new Error('Tidak menemukan tabel dengan kolom "JENIS" dan "NAMA/MERK" di file ini');
}