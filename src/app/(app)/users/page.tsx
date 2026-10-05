import { requireRole } from "@/lib/auth";

export default async function UsersPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">User Management</h1>
      <p className="text-sm text-muted-foreground">Halaman khusus Admin. Isi akan dibuat nanti.</p>
    </div>
  );
}