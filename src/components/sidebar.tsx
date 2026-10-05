"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/nav";
import type { Role } from "@/lib/auth";

export function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      {navGroups.map((group, i) => {
        const items = group.items.filter((it) => it.roles.includes(role));
        if (items.length === 0) return null;
        return (
          <div key={i} className="space-y-1">
            {group.title && (
              <p className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">
                {group.title}
              </p>
            )}
            {items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <Warehouse className="h-5 w-5" />
        Saka Inventory
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <NavLinks role={role} />
      </nav>
    </aside>
  );
}