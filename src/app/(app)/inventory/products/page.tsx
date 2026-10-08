import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { MasterCrud, type Row } from "@/components/master/master-crud";
import { deleteUnusedProduct } from "@/lib/actions/master";

type ProductRow = Row & {
  categories: { name: string } | null;
  units: { name: string } | null;
  suppliers: { name: string } | null;
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const [products, cats, units, sups] = await Promise.all([
    supabase.from("products").select("*, categories(name), units(name), suppliers(name)").order("name"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("units").select("id, name").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
  ]);

  // Ratakan hasil join agar mudah ditampilkan di tabel
  const rows = ((products.data ?? []) as unknown as ProductRow[]).map((p) => ({
    ...p,
    category_name: p.categories?.name ?? null,
    unit_name: p.units?.name ?? null,
    supplier_name: p.suppliers?.name ?? null,
  })) as Row[];

  const opt = (d: { id: string; name: string }[] | null) =>
    (d ?? []).map((x) => ({ value: x.id, label: x.name }));

  return (
    <MasterCrud
      title="Barang"
      description="Master barang. Kode dibuat otomatis oleh sistem."
      table="products"
      rows={rows}
      columns={[
        { key: "code", label: "Kode" },
        { key: "name", label: "Nama Barang" },
        { key: "category_name", label: "Kategori" },
        { key: "unit_name", label: "Satuan" },
        { key: "condition", label: "Kondisi" },
        { key: "minimum_stock", label: "Min. Stok", type: "number" },
        { key: "default_price", label: "Harga Beli", type: "currency" },
        // di dalam columns={[ ... ]}, setelah kolom harga beli:
        { key: "track_serial", label: "Lacak SN", type: "boolean" },
        // di columns, setelah kolom "Lacak SN":
{ key: "pon_type", label: "Tipe PON" },
      ]}
      fields={[
        { name: "name", label: "Nama Barang", type: "text", required: true, full: true },
        { name: "category_id", label: "Kategori", type: "select", options: opt(cats.data) },
        { name: "unit_id", label: "Satuan", type: "select", options: opt(units.data) },
        { name: "supplier_id", label: "Supplier", type: "select", options: opt(sups.data) },
        {
          name: "condition", label: "Kondisi", type: "select", required: true,
          options: [
            { value: "NEW", label: "NEW (baru)" },
            { value: "OLD", label: "OLD (lama)" },
            { value: "RETURN", label: "RETURN (retur)" },
          ],
        },
        { name: "brand", label: "Merk", type: "text" },
        { name: "minimum_stock", label: "Minimum Stok", type: "number" },
        { name: "default_price", label: "Harga Beli (Rp)", type: "number" },
        { name: "specification", label: "Spesifikasi", type: "textarea" },
        // di dalam fields={[ ... ]}, sebelum field "Keterangan":
{ name: "track_serial", label: "Lacak nomor SN per unit (untuk router)", type: "checkbox" },
// di fields, setelah field "Lacak SN":
{
  name: "pon_type", label: "Tipe PON (untuk router)", type: "select",
  options: [{ value: "GPON", label: "GPON" }, { value: "EPON", label: "EPON" }],
},
        { name: "description", label: "Keterangan", type: "textarea" },
      ]}
      // di searchKeys, tambahkan "pon_type" agar bisa dicari dengan mengetik GPON:
searchKeys={["code", "name", "specification", "category_name", "brand", "pon_type"]}
      canEdit={profile?.role === "ADMIN"}
       onDelete={deleteUnusedProduct}
    />
  );
}