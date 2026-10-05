"use client";

import { useEffect, useState } from "react";
import { Menu, Warehouse, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/sidebar";
import type { Role } from "@/lib/auth";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  // kunci scroll halaman saat menu terbuka
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="flex items-center gap-2 font-semibold">
                <Warehouse className="h-5 w-5" />
                Saka Inventory
              </span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Tutup menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavLinks role={role} onNavigate={() => setOpen(false)} />
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}