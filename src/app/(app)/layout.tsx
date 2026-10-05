import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile || !profile.is_active) redirect("/login");

  return (
    <div className="flex h-screen">
      <Sidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}