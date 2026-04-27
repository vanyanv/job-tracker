import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.12em] uppercase transition-colors duration-200",
  {
    variants: {
      tone: {
        neutral: "border-foreground/10 bg-foreground/4 text-foreground/80",
        active: "border-apricot/35 bg-apricot/18 text-foreground",
        muted: "border-foreground/8 bg-transparent text-muted-foreground",
        warning: "border-amber-warm/30 bg-amber-warm/8 text-amber-warm",
        success: "border-sage/30 bg-sage/8 text-sage",
        rose: "border-rose-warm/30 bg-rose-warm/8 text-rose-warm",
        cornflower: "border-cornflower/30 bg-cornflower/10 text-cornflower",
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
