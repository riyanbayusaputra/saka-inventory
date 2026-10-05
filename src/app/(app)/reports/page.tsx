import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const REPORT_ORDER = ["stock", "stock-movement", "low-stock"];

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Laporan</h1>
        <p className="text-sm text-muted-foreground">
          Pilih laporan. Hasilnya bisa diekspor ke Excel, CSV, atau PDF.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_ORDER.map((key) => {
          const reportKey = String(key);

          return (
            <Link key={reportKey} href={`/reports/${reportKey}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileBarChart className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {reportKey
                        .replaceAll("-", " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Lihat dan ekspor data laporan ini.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
