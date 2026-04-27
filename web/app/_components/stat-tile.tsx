import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "apricot" | "sage" | "amber" | "rose";

const TONE: Record<Tone, { value: string; ring: string; glow: string }> = {
  default: {
    value: "text-foreground",
    ring: "",
    glow: "",
  },
  apricot: {
    value: "text-[var(--apricot)]",
    ring: "shadow-[inset_0_0_0_1px_oklch(0.68_0.22_260_/_22%)]",
    glow: "before:bg-[radial-gradient(circle_at_30%_-20%,oklch(0.68_0.22_260_/_18%),transparent_60%)]",
  },
  sage: {
    value: "text-[var(--sage)]",
    ring: "shadow-[inset_0_0_0_1px_oklch(0.71_0.14_157_/_22%)]",
    glow: "before:bg-[radial-gradient(circle_at_30%_-20%,oklch(0.71_0.14_157_/_16%),transparent_60%)]",
  },
  amber: {
    value: "text-[var(--amber-warm)]",
    ring: "shadow-[inset_0_0_0_1px_oklch(0.84_0.16_93_/_22%)]",
    glow: "before:bg-[radial-gradient(circle_at_30%_-20%,oklch(0.84_0.16_93_/_18%),transparent_60%)]",
  },
  rose: {
    value: "text-[var(--rose-warm)]",
    ring: "shadow-[inset_0_0_0_1px_oklch(0.68_0.125_26_/_22%)]",
    glow: "before:bg-[radial-gradient(circle_at_30%_-20%,oklch(0.68_0.125_26_/_18%),transparent_60%)]",
  },
};

export function StatTile({
  label,
  value,
  caption,
  tone = "default",
  display = false,
  className,
  delay,
}: {
  label: string;
  value: number | string;
  caption?: React.ReactNode;
  tone?: Tone;
  display?: boolean;
  className?: string;
  delay?: number;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "hearth-enter relative overflow-hidden rounded-2xl surface px-4 py-3.5",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-90",
        t.ring,
        t.glow,
        className,
      )}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "relative mt-1 leading-none tracking-tight tabular-nums",
          display
            ? "font-display text-[32px] font-medium"
            : "font-mono text-2xl",
          t.value,
        )}
      >
        {value}
      </div>
      {caption && (
        <div className="relative mt-1.5 text-[11px] leading-snug text-muted-foreground/85">
          {caption}
        </div>
      )}
    </div>
  );
}
