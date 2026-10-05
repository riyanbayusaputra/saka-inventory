import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { REPORTS, type ReportType } from "@/lib/reports";
import { ReportViewer } from "@/components/reports/report-viewer";

export default async function ReportPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(type in REPORTS)) notFound();

  const supabase = await createClient();
  const [sites, cats, sups] = await Promise.all([
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  return (
    <div className="space-y-4">
      <Link href="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Semua laporan
      </Link>
      <ReportViewer
        type={type as ReportType}
        sites={sites.data ?? []}
        categories={cats.data ?? []}
        suppliers={sups.data ?? []}
        defaultFrom={today.slice(0, 8) + "01"}
        defaultTo={today}
      />
    </div>
  );
}