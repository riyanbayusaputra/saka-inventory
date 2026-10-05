"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveOpname, deleteOpname, rejectOpname, submitOpname } from "@/lib/actions/opname";
import type { OpnameStatus } from "@/lib/opname";

type Role = "ADMIN" | "STAFF" | "VIEWER";

export function OpnameActions({ id, status, role }: { id: string; status: OpnameStatus; role: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (role === "VIEWER" || status === "DISETUJUI" || status === "DITOLAK") return null;
  const isAdmin = role === "ADMIN";

  function run(fn: () => Promise<{ error?: string }>, okMsg: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(okMsg);
      if (after) after();
      else router.refresh();
    });
  }

  function onApprove() {
    if (!window.confirm("Setujui opname ini? Stok akan disesuaikan dengan hasil hitung fisik.")) return;
    run(() => approveOpname(id, null), "Opname disetujui, stok disesuaikan");
  }

  function onReject() {
    const note = window.prompt("Alasan penolakan:");
    if (note === null) return;
    run(() => rejectOpname(id, note), "Opname ditolak");
  }

  function onDelete() {
    if (!window.confirm("Hapus draft opname ini?")) return;
    run(() => deleteOpname(id), "Draft dihapus", () => router.push("/inventory/opname"));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <>
          <Link href={`/inventory/opname/${id}/edit`}>
            <Button variant="outline"><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
          </Link>
          <Button disabled={pending} onClick={() => run(() => submitOpname(id), "Opname diajukan")}>
            Ajukan
          </Button>
        </>
      )}
      {isAdmin && (
        <>
          <Button disabled={pending} onClick={onApprove}>Setujui</Button>
          <Button variant="destructive" disabled={pending} onClick={onReject}>Tolak</Button>
        </>
      )}
      {status === "DRAFT" && (
        <Button variant="outline" disabled={pending} onClick={onDelete}>Hapus Draft</Button>
      )}
    </div>
  );
}