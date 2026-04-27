import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "apricot" | "sage" | "amber" | "rose" | "cornflower";

const EDGE: Record<Tone, string> = {
  default: "",
  apricot: "edge-highlight-apricot",
  sage: "edge-highlight-sage",
  amber: "edge-highlight-amber",
  rose: "edge-highlight-rose",
  cornflower: "edge-highlight-cornflower",
};

const VALUE_COLOR: Record<Tone, string> = {
  default: "text-foreground",
  apricot: "text-foreground",
  sage: "text-[var(--sage)]",
  amber: "text-[var(--amber-warm)]",
  rose: "text-[var(--rose-warm)]",
  cornflower: "text-[var(--cornflower)]",
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
  return (
    <div
      className={cn(
        "hearth-enter relative overflow-hidden rounded-md surface px-4 py-3.5",
        EDGE[tone],
        className,
      )}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="label-caps text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1.5 leading-none tracking-tight tnum",
          display
            ? "font-display text-[36px] font-medium"
            : "font-mono text-[26px] font-medium",
          VALUE_COLOR[tone],
        )}
      >
        {value}
      </div>
      {caption && (
        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground/85">
          {caption}
        </div>
      )}
    </div>
  );
}
