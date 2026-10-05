import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { MasterCrud, type Row } from "@/components/master/master-crud";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const { data } = await supabase.from("suppliers").select("*").order("name");

  return (
    <MasterCrud
      title="Supplier"
      description="Daftar pemasok barang."
      table="suppliers"
      rows={(data ?? []) as Row[]}
      columns={[
        { key: "name", label: "Nama Supplier" },
        { key: "phone", label: "Telepon" },
        { key: "email", label: "Email" },
        { key: "address", label: "Alamat" },
      ]}
      fields={[
        { name: "name", label: "Nama Supplier", type: "text", required: true, full: true },
        { name: "phone", label: "Telepon", type: "text" },
        { name: "email", label: "Email", type: "text" },
        { name: "address", label: "Alamat", type: "textarea" },
      ]}
      searchKeys={["name", "phone", "email"]}
      canEdit={profile?.role === "ADMIN"}
    />
  );
}