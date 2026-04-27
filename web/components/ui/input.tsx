import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-xl border border-input bg-foreground/[0.025] px-3.5 py-2 text-sm font-normal text-foreground outline-none",
        "shadow-[inset_0_1px_0_oklch(1_0_0_/_4%)]",
        "transition-[color,box-shadow,border-color,background-color] duration-200 ease-[var(--ease-out)]",
        "placeholder:text-muted-foreground/60",
        "selection:bg-[var(--apricot)]/30 selection:text-foreground",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "hover:border-foreground/15",
        "focus-visible:border-[var(--apricot)]/40 focus-visible:ring-2 focus-visible:ring-[var(--apricot)]/25 focus-visible:bg-foreground/[0.04]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
