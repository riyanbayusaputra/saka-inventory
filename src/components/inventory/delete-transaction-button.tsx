"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteTransaction } from "@/lib/actions/transactions";

export function DeleteTransactionButton({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function onConfirm() {
    if (!reason.trim()) return void toast.error("Alasan wajib diisi");
    start(async () => {
      const res = await deleteTransaction(id, reason);
      if (res.error) return void toast.error(res.error);
      toast.success(`Transaksi ${number} dihapus, stok dikembalikan`);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Hapus transaksi">
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus transaksi {number}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stok dan nomor SN dikembalikan seperti sebelum transaksi ini. Penghapusan tidak bisa dibatalkan,
            tetapi tercatat di Audit Log.
          </p>
          <Textarea
            rows={3}
            placeholder="Alasan penghapusan (wajib), contoh: uji coba / salah input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? "Menghapus..." : "Hapus"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}