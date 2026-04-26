import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-foreground/15 bg-foreground/5 text-foreground/80",
        active: "border-emerald-700/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
        muted: "border-foreground/10 bg-transparent text-muted-foreground",
        warning: "border-amber-700/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }
