import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 border-b border-foreground/10 px-7 py-6 md:px-9 md:py-7",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-xl font-medium tracking-tight text-foreground md:text-2xl">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
