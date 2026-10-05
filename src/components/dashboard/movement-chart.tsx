export type MonthPoint = { label: string; in: number; out: number };

export function MovementChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.in, d.out]));
  const pct = (v: number) => (v > 0 ? Math.max(3, (v / max) * 100) : 0);

  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-green-600" /> Stock In
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-500" /> Stock Out
        </span>
      </div>

      <div className="flex h-52 items-end gap-2 border-b">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 items-end justify-center gap-1">
            <div
              className="w-full max-w-6 rounded-t bg-green-600"
              style={{ height: `${pct(d.in)}%` }}
              title={`Stock In: ${d.in}`}
            />
            <div
              className="w-full max-w-6 rounded-t bg-red-500"
              style={{ height: `${pct(d.out)}%` }}
              title={`Stock Out: ${d.out}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-xs">
            <p className="font-medium">{d.label}</p>
            <p className="text-green-700">{d.in}</p>
            <p className="text-red-600">{d.out}</p>
          </div>
        ))}
      </div>
    </div>
  );
}