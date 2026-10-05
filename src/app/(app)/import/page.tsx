import { requireRole } from "@/lib/auth";
import { ImportTabs } from "@/components/import/import-panel";

export default async function ImportPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Import Excel</h1>
        <p className="text-sm text-muted-foreground">
          Pindahkan data dari spreadsheet lama. Kerjakan berurutan: Master Barang dulu, lalu Saldo Awal.
        </p>
      </div>
      <ImportTabs />
    </div>
  );
}