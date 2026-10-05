import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { MasterCrud, type Row } from "@/components/master/master-crud";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const { data } = await supabase.from("categories").select("*").order("name");

  return (
    <MasterCrud
      title="Kategori"
      description="Kategori barang seperti Router, Kabel, Patchcore."
      table="categories"
      rows={(data ?? []) as Row[]}
      columns={[{ key: "name", label: "Nama Kategori" }]}
      fields={[{ name: "name", label: "Nama Kategori", type: "text", required: true, full: true }]}
      searchKeys={["name"]}
      canEdit={profile?.role === "ADMIN"}
    />
  );
}