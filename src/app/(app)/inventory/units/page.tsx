import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { MasterCrud, type Row } from "@/components/master/master-crud";

export default async function UnitsPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const { data } = await supabase.from("units").select("*").order("name");

  return (
    <MasterCrud
      title="Satuan"
      description="Satuan barang seperti Pcs, Roll, Meter."
      table="units"
      rows={(data ?? []) as Row[]}
      columns={[{ key: "name", label: "Nama Satuan" }]}
      fields={[{ name: "name", label: "Nama Satuan", type: "text", required: true, full: true }]}
      searchKeys={["name"]}
      canEdit={profile?.role === "ADMIN"}
    />
  );
}