import { requireRole } from "@/lib/auth";
import { loadFormData } from "@/lib/form-data";
import { OpnameForm } from "@/components/inventory/opname-form";

export default async function NewOpnamePage() {
  await requireRole(["ADMIN", "STAFF"]);
  const data = await loadFormData();
  return <OpnameForm {...data} />;
}