import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function UnicoinIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow",
        className,
      )}
    >
      <Coins className="h-3 w-3" />
    </span>
  );
}

export function UnicoinAmount({
  amount,
  className,
  size = "md",
}: {
  amount: number | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: { wrap: "text-sm gap-1", icon: "h-4 w-4" },
    md: { wrap: "text-base gap-1.5", icon: "h-5 w-5" },
    lg: { wrap: "text-xl gap-2", icon: "h-6 w-6" },
    xl: { wrap: "text-3xl gap-2.5", icon: "h-7 w-7" },
  } as const;
  const s = sizes[size];
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return (
    <span className={cn("inline-flex items-center font-semibold tracking-tight", s.wrap, className)}>
      <UnicoinIcon className={s.icon} />
      <span>{safeAmount.toLocaleString()}</span>
    </span>
  );
}
