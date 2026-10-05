export type PoStatus =
  | "DRAFT" | "DIAJUKAN" | "DISETUJUI" | "DIPROSES"
  | "SEBAGIAN_DITERIMA" | "SELESAI" | "DIBATALKAN";

export const STATUS_LIST: PoStatus[] = [
  "DRAFT", "DIAJUKAN", "DISETUJUI", "DIPROSES", "SEBAGIAN_DITERIMA", "SELESAI", "DIBATALKAN",
];

export const STATUS_LABEL: Record<PoStatus, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DISETUJUI: "Disetujui",
  DIPROSES: "Diproses",
  SEBAGIAN_DITERIMA: "Sebagian Diterima",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

export const STATUS_VARIANT: Record<PoStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  DIAJUKAN: "outline",
  DISETUJUI: "default",
  DIPROSES: "default",
  SEBAGIAN_DITERIMA: "outline",
  SELESAI: "default",
  DIBATALKAN: "destructive",
};

// Perpindahan status manual yang diperbolehkan.
// SEBAGIAN_DITERIMA dan SELESAI otomatis lewat Penerimaan Barang.
export const TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  DRAFT: ["DIAJUKAN", "DIBATALKAN"],
  DIAJUKAN: ["DISETUJUI", "DRAFT", "DIBATALKAN"],
  DISETUJUI: ["DIPROSES", "DIBATALKAN"],
  DIPROSES: ["DIBATALKAN"],
  SEBAGIAN_DITERIMA: ["SELESAI"],
  SELESAI: [],
  DIBATALKAN: [],
};

// Status yang boleh menerima barang
export const RECEIVABLE: PoStatus[] = ["DISETUJUI", "DIPROSES", "SEBAGIAN_DITERIMA"];