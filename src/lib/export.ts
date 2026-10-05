import * as XLSX from "xlsx";
import type { Cell, Col, Row } from "@/lib/actions/reports";

const PDF_MAX_ROWS = 3000;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileBase(title: string) {
  const d = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Jakarta",
  });
  return `${title.replace(/\s+/g, "-").toLowerCase()}-${d}`;
}

function fmt(v: Cell | undefined, type?: Col["type"]) {
  if (v === null || v === undefined || v === "") return "-";
  if (type === "currency")
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(v));
  if (type === "number")
    return new Intl.NumberFormat("id-ID").format(Number(v));
  return String(v);
}

export { fmt as formatCell };

export function exportCsv(title: string, cols: Col[], rows: Row[]) {
  const aoa = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => r[c.key] ?? "")),
  ];
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(aoa));
  // BOM agar Excel membaca UTF-8 dengan benar
  download(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    `${fileBase(title)}.csv`,
  );
}

export function exportXlsx(title: string, cols: Col[], rows: Row[]) {
  const aoa = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => r[c.key] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = cols.map((c) => ({
    wch: Math.min(
      40,
      Math.max(
        c.label.length,
        ...rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length),
      ) + 2,
    ),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${fileBase(title)}.xlsx`);
}

export async function exportPdf(
  title: string,
  subtitle: string,
  cols: Col[],
  rows: Row[],
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.text(subtitle, 40, 52);

  const right: Record<number, { halign: "right" }> = {};
  cols.forEach((c, i) => {
    if (c.type === "number" || c.type === "currency")
      right[i] = { halign: "right" };
  });

  autoTable(doc, {
    startY: 64,
    head: [cols.map((c) => c.label)],
    body: rows
      .slice(0, PDF_MAX_ROWS)
      .map((r) => cols.map((c) => fmt(r[c.key], c.type))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: right,
  });

  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(`Halaman ${i} dari ${pages}`, w - 40, h - 20, { align: "right" });
    doc.text("PT Saka Media Komunika - Inventory", 40, h - 20);
  }

  doc.save(`${fileBase(title)}.pdf`);
  return rows.length > PDF_MAX_ROWS;
}
