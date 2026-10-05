import { LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/mobile-nav";
import { logout } from "@/app/login/actions";
import type { Profile } from "@/lib/auth";

const roleLabel = { ADMIN: "Admin", STAFF: "Staff Gudang", VIEWER: "Viewer" } as const;

export function Topbar({ profile }: { profile: Profile }) {
  const name = profile.full_name || profile.email || "User";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-3 sm:gap-4 sm:px-4">
      <MobileNav role={profile.role} />

      <div className="relative min-w-0 max-w-md flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari barang, PO, transaksi..." className="pl-9" disabled />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="ml-auto flex shrink-0 items-center gap-3 rounded-md px-2 py-1 outline-none hover:bg-muted">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none">{name}</p>
            <Badge variant="secondary" className="mt-1">{roleLabel[profile.role]}</Badge>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:hidden">{roleLabel[profile.role]}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center rounded-md px-1.5 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Keluar
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}