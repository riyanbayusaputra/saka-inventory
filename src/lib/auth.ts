import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "ADMIN" | "STAFF" | "VIEWER";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
};

// cache: dipanggil berkali-kali dalam satu request, query hanya sekali
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", user.id)
    .single();

  return (data as Profile | null) ?? null;
});

// Pakai di halaman yang dibatasi role tertentu
export async function requireRole(allowed: Role[]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!allowed.includes(profile.role)) redirect("/dashboard");
  return profile;
}