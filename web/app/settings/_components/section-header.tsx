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
        "flex items-start justify-between gap-6 border-b divider-warm px-7 py-7 md:px-9 md:py-8",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="label-caps text-muted-foreground">{eyebrow}</div>
        <h2 className="mt-2.5 font-display italic text-[24px] font-medium tracking-tight text-foreground md:text-[28px]">
          {title}
        </h2>
        <p className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
