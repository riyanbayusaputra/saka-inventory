import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

export function StatCard({
  label, value, icon: Icon, tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", toneClass[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}