import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:opacity-50",
        "dark:bg-input/30",
        "resize-y",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
