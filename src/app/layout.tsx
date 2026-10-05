import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Saka Media Inventory",
  description: "Sistem Inventory & Stock Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={geist.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}