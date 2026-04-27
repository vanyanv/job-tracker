import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-h-28 rounded-xl border border-input bg-foreground/2.5 px-3.5 py-2.5 text-sm text-foreground outline-none resize-y",
        "shadow-[inset_0_1px_0_oklch(1_0_0/4%)]",
        "transition-[color,box-shadow,border-color,background-color] duration-200 ease-out",
        "placeholder:text-muted-foreground/60",
        "hover:border-foreground/15",
        "focus-visible:border-(--apricot)/40 focus-visible:ring-2 focus-visible:ring-(--apricot)/25 focus-visible:bg-foreground/4",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
