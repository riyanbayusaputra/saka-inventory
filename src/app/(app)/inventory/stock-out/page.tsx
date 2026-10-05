import { requireRole } from "@/lib/auth";
import { loadFormData } from "@/lib/form-data";
import { TransactionForm } from "@/components/inventory/transaction-form";

export default async function StockOutPage() {
  await requireRole(["ADMIN", "STAFF"]);
  const data = await loadFormData();
  return <TransactionForm type="OUT" {...data} />;
}