import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { MasterCrud, type Row } from "@/components/master/master-crud";

export default async function SitesPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const { data } = await supabase.from("sites").select("*").order("name");

  return (
    <MasterCrud
      title="Site"
      description="Lokasi penyimpanan barang: gudang dan site lapangan."
      table="sites"
      rows={(data ?? []) as Row[]}
      columns={[
        { key: "code", label: "Kode" },
        { key: "name", label: "Nama Site" },
        { key: "pic", label: "PIC" },
        { key: "phone", label: "Telepon" },
        { key: "is_warehouse", label: "Gudang", type: "boolean" },
      ]}
      fields={[
        { name: "code", label: "Kode Site", type: "text", required: true },
        { name: "name", label: "Nama Site", type: "text", required: true },
        { name: "pic", label: "PIC", type: "text" },
        { name: "phone", label: "Nomor Telepon", type: "text" },
        { name: "address", label: "Alamat", type: "textarea" },
        { name: "is_warehouse", label: "Ini adalah gudang pusat", type: "checkbox" },
      ]}
      searchKeys={["code", "name", "pic"]}
      canEdit={profile?.role === "ADMIN"}
    />
  );
}