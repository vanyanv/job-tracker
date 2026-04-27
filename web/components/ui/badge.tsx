import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-[0.04em] uppercase transition-colors duration-200",
  {
    variants: {
      tone: {
        neutral: "border-foreground/12 bg-foreground/4 text-foreground/80",
        active: "border-(--apricot)/30 bg-(--apricot)/12 text-(--apricot)",
        muted: "border-foreground/8 bg-transparent text-muted-foreground",
        warning: "border-(--amber-warm)/30 bg-(--amber-warm)/12 text-(--amber-warm)",
        success: "border-(--sage)/30 bg-(--sage)/12 text-(--sage)",
        rose: "border-(--rose-warm)/30 bg-(--rose-warm)/12 text-(--rose-warm)",
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
