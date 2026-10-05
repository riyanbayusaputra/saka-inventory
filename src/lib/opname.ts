export type OpnameStatus = "DRAFT" | "DIAJUKAN" | "DISETUJUI" | "DITOLAK";

export const OPNAME_STATUS_LIST: OpnameStatus[] = ["DRAFT", "DIAJUKAN", "DISETUJUI", "DITOLAK"];

export const OPNAME_LABEL: Record<OpnameStatus, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
};

export const OPNAME_VARIANT: Record<OpnameStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  DIAJUKAN: "outline",
  DISETUJUI: "default",
  DITOLAK: "destructive",
};