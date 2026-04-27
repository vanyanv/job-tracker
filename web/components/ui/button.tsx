import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none",
    "transition-[background-color,color,border-color,transform,filter,box-shadow] duration-200 ease-[var(--ease-out)]",
    "active:not-aria-[haspopup]:scale-[0.97]",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--apricot)] text-[var(--apricot-foreground)]",
          "shadow-[inset_0_1px_0_oklch(1_0_0_/_28%),0_4px_18px_-6px_oklch(0.78_0.13_55_/_50%)]",
          "hover:brightness-[1.06]",
        ].join(" "),
        outline: [
          "border-border bg-transparent text-foreground",
          "shadow-[inset_0_1px_0_oklch(1_0_0_/_5%)]",
          "hover:bg-[var(--surface-2)] hover:border-foreground/15",
          "aria-expanded:bg-[var(--surface-2)]",
        ].join(" "),
        secondary: [
          "bg-[var(--surface-2)] text-foreground",
          "shadow-[inset_0_1px_0_oklch(1_0_0_/_5%)]",
          "hover:brightness-[1.08]",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-foreground/[0.045] hover:text-foreground",
          "aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground",
        ].join(" "),
        sage: [
          "bg-[var(--sage)] text-[var(--sage-foreground)]",
          "shadow-[inset_0_1px_0_oklch(1_0_0_/_24%),0_4px_18px_-6px_oklch(0.74_0.085_155_/_45%)]",
          "hover:brightness-[1.06]",
        ].join(" "),
        destructive: [
          "bg-[var(--rose-warm)]/15 text-[var(--rose-warm)] border border-[var(--rose-warm)]/25",
          "hover:bg-[var(--rose-warm)]/25",
        ].join(" "),
        link: "rounded-none text-[var(--apricot)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
