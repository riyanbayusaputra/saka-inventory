"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeStatus } from "@/lib/actions/po";
import { TRANSITIONS, type PoStatus } from "@/lib/po";

type Role = "ADMIN" | "STAFF" | "VIEWER";

const BUTTONS: Record<PoStatus, { label: string; variant: "default" | "outline" | "destructive"; confirm?: string }> = {
  DIAJUKAN: { label: "Ajukan PO", variant: "default" },
  DISETUJUI: { label: "Setujui", variant: "default" },
  DIPROSES: { label: "Tandai Diproses", variant: "default" },
  SELESAI: { label: "Tutup PO (Selesai)", variant: "outline", confirm: "Tutup PO ini? Sisa barang yang belum datang tidak akan diterima lagi." },
  DRAFT: { label: "Kembalikan ke Draft", variant: "outline" },
  DIBATALKAN: { label: "Batalkan PO", variant: "destructive", confirm: "Batalkan PO ini? Tindakan ini tidak dapat dikembalikan." },
  SEBAGIAN_DITERIMA: { label: "", variant: "outline" },
};

export function PoActions({ poId, status, role }: { poId: string; status: PoStatus; role: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (role === "VIEWER") return null;

  const options = TRANSITIONS[status].filter((to) => {
    if (role === "ADMIN") return true;
    return status === "DRAFT" && (to === "DIAJUKAN" || to === "DIBATALKAN");
  });

  function go(to: PoStatus) {
    const conf = BUTTONS[to].confirm;
    if (conf && !window.confirm(conf)) return;
    start(async () => {
      const res = await changeStatus(poId, to);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Status diperbarui");
        router.refresh();
      }
    });
  }

  if (options.length === 0 && status !== "DRAFT") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <Button
          variant="outline"
          onClick={() => router.push(`/procurement/purchase-orders/${poId}/edit`)}
        >
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      )}
      {options.map((to) => (
        <Button key={to} variant={BUTTONS[to].variant} disabled={pending} onClick={() => go(to)}>
          {BUTTONS[to].label}
        </Button>
      ))}
    </div>
  );
}