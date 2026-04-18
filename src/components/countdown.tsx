import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function format(ms: number) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, ended: true };
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s, ended: false };
}

export function Countdown({
  endsAt,
  className,
  compact = false,
}: {
  endsAt: number;
  className?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const { d, h, m, s, ended } = format(endsAt - now);

  if (ended) {
    return <span className={cn("font-mono text-xs text-muted-foreground", className)}>Ended</span>;
  }

  const urgent = endsAt - now < 60 * 60 * 1000;

  if (compact) {
    let label = "";
    if (d > 0) label = `${d}d ${h}h`;
    else if (h > 0) label = `${h}h ${m}m`;
    else label = `${m}m ${String(s).padStart(2, "0")}s`;
    return (
      <span
        className={cn(
          "font-mono text-xs font-semibold tabular-nums",
          urgent ? "text-destructive" : "text-foreground",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <div className={cn("flex items-baseline gap-1 font-mono tabular-nums", className)}>
      {d > 0 && (
        <>
          <span className="text-lg font-bold">{d}</span>
          <span className="text-xs text-muted-foreground">d</span>
        </>
      )}
      <span className="text-lg font-bold">{String(h).padStart(2, "0")}</span>
      <span className="text-xs text-muted-foreground">h</span>
      <span className="text-lg font-bold">{String(m).padStart(2, "0")}</span>
      <span className="text-xs text-muted-foreground">m</span>
      <span className={cn("text-lg font-bold", urgent && "text-destructive")}>
        {String(s).padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground">s</span>
    </div>
  );
}
