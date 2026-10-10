"use client";

import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCsv, exportPdf, exportXlsx } from "@/lib/export";
import type { Col, Row } from "@/lib/reports";

export function StockCardExport({
  title, subtitle, cols, rows,
}: {
  title: string;
  subtitle: string;
  cols: Col[];
  rows: Row[];
}) {
  const disabled = rows.length === 0;

  async function onPdf() {
    try {
      const cut = await exportPdf(title, subtitle, cols, rows);
      if (cut) toast.info("PDF dibatasi 3.000 baris pertama. Gunakan Excel untuk data lengkap.");
    } catch {
      toast.error("Gagal membuat PDF");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={disabled} onClick={() => exportXlsx(title, cols, rows)}>
        <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" disabled={disabled} onClick={() => exportCsv(title, cols, rows)}>
        <Download className="mr-2 h-4 w-4" /> CSV
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onPdf}>
        <FileText className="mr-2 h-4 w-4" /> PDF
      </Button>
    </div>
  );
}