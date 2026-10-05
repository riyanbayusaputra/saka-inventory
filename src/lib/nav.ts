import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  PackagePlus,
  PackageMinus,
  Truck,
  ClipboardCheck,
  ShoppingCart,
  Building2,
  MapPin,
  FileBarChart,
  Users,
  Tags,
  Ruler,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/auth";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
};

export type NavGroup = { title?: string; items: NavItem[] };

const ALL: Role[] = ["ADMIN", "STAFF", "VIEWER"];
const WRITE: Role[] = ["ADMIN", "STAFF"];

export const navGroups: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL }],
  },
  {
    title: "Inventory",
    items: [
      { label: "Barang", href: "/inventory/products", icon: Package, roles: ALL },
      { label: "Kategori", href: "/inventory/categories", icon: Tags, roles: ALL },
      { label: "Satuan", href: "/inventory/units", icon: Ruler, roles: ALL },
      { label: "Stok", href: "/inventory/stock", icon: Boxes, roles: ALL },
      { label: "Transaksi", href: "/inventory/transactions", icon: ArrowLeftRight, roles: ALL },
      { label: "Stock In", href: "/inventory/stock-in", icon: PackagePlus, roles: WRITE },
      { label: "Stock Out", href: "/inventory/stock-out", icon: PackageMinus, roles: WRITE },
      { label: "Transfer", href: "/inventory/transfer", icon: Truck, roles: WRITE },
      { label: "Stock Opname", href: "/inventory/opname", icon: ClipboardCheck, roles: ALL },
    ],
  },
  {
    title: "Pengadaan",
    items: [
      { label: "Purchase Order", href: "/procurement/purchase-orders", icon: ShoppingCart, roles: ALL },
      { label: "Supplier", href: "/procurement/suppliers", icon: Building2, roles: ALL },
    ],
  },
  {
    title: "Lainnya",
    items: [
      { label: "Site", href: "/sites", icon: MapPin, roles: ALL },
      { label: "Laporan", href: "/reports", icon: FileBarChart, roles: ALL },
      { label: "User", href: "/users", icon: Users, roles: ["ADMIN"] },
      { label: "Import Excel", href: "/import", icon: Upload, roles: ["ADMIN"] },
    ],
  },
];