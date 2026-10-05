import { STATUS_LABEL, STATUS_LIST } from "@/lib/po";
import { OPNAME_LABEL, OPNAME_STATUS_LIST } from "@/lib/opname";

export type ReportType =
  | "stock" | "stock-in" | "stock-out" | "movement"
  | "procurement" | "per-site" | "products" | "opname";

export type Col = { key: string; label: string; type?: "text" | "number" | "currency" };
export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export type ReportData = {
  columns: Col[];
  rows: Row[];
  truncated: boolean;
  error?: string;
};

export type FilterKey = "date" | "site" | "category" | "supplier" | "q" | "trxType" | "status";

export type Filters = {
  from?: string;
  to?: string;
  siteId?: string;
  categoryId?: string;
  supplierId?: string;
  q?: string;
  trxType?: string;
  status?: string;
};

type Option = { value: string; label: string };

export type ReportConfig = {
  title: string;
  desc: string;
  filters: FilterKey[];
  statusOptions?: Option[];
};

export const TRX_TYPE_OPTIONS: Option[] = [
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "RETURN", label: "Retur" },
];

export const REPORTS: Record<ReportType, ReportConfig> = {
  stock: {
    title: "Laporan Stok",
    desc: "Stok barang per site beserta status terhadap minimum stok.",
    filters: ["site", "category", "q", "status"],
    statusOptions: [
      { value: "SAFE", label: "Aman" },
      { value: "LOW_STOCK", label: "Stok Menipis" },
      { value: "OUT_OF_STOCK", label: "Habis" },
    ],
  },
  "stock-in": {
    title: "Laporan Stock In",
    desc: "Semua barang masuk, termasuk penerimaan PO dan saldo awal.",
    filters: ["date", "site", "category", "supplier", "q"],
  },
  "stock-out": {
    title: "Laporan Stock Out",
    desc: "Semua barang keluar beserta pemakai dan keperluannya.",
    filters: ["date", "site", "category", "q"],
  },
  movement: {
    title: "Laporan Mutasi",
    desc: "Buku besar pergerakan stok: masuk, keluar, transfer, dan penyesuaian beserta saldonya.",
    filters: ["date", "site", "category", "q", "trxType"],
  },
  procurement: {
    title: "Laporan Pengadaan",
    desc: "Rincian Purchase Order per barang, termasuk jumlah yang sudah diterima.",
    filters: ["date", "site", "supplier", "category", "q", "status"],
    statusOptions: STATUS_LIST.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  },
  "per-site": {
    title: "Laporan Per Site",
    desc: "Ringkasan jumlah barang dan nilai inventory di tiap site.",
    filters: ["site", "category"],
  },
  products: {
    title: "Laporan Barang",
    desc: "Master barang lengkap dengan total stok dan harga.",
    filters: ["category", "supplier", "q", "status"],
    statusOptions: [
      { value: "ACTIVE", label: "Aktif" },
      { value: "INACTIVE", label: "Nonaktif" },
    ],
  },
  opname: {
    title: "Laporan Stock Opname",
    desc: "Hasil penghitungan fisik dan selisihnya terhadap stok sistem.",
    filters: ["date", "site", "category", "q", "status"],
    statusOptions: OPNAME_STATUS_LIST.map((s) => ({ value: s, label: OPNAME_LABEL[s] })),
  },
};

export const REPORT_ORDER: ReportType[] = [
  "stock", "products", "per-site", "stock-in", "stock-out", "movement", "procurement", "opname",
];