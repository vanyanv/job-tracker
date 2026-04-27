import { cn } from "@/lib/utils";

type Position =
  | "top-right"
  | "top-left"
  | "top-center"
  | "bottom-right"
  | "bottom-left";
type Size = "sm" | "md" | "lg" | "xl";
type Hue = "apricot" | "sage" | "amber";

const POSITION: Record<Position, string> = {
  "top-right": "top-[-30%] right-[-15%]",
  "top-left": "top-[-30%] left-[-15%]",
  "top-center": "top-[-40%] left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-[-40%] right-[-20%]",
  "bottom-left": "bottom-[-40%] left-[-20%]",
};

const SIZE: Record<Size, string> = {
  sm: "h-[280px] w-[280px]",
  md: "h-[440px] w-[440px]",
  lg: "h-[640px] w-[640px]",
  xl: "h-[920px] w-[920px]",
};

const HUE: Record<Hue, string> = {
  apricot:
    "bg-[radial-gradient(circle_at_center,oklch(0.68_0.22_260_/_28%)_0%,oklch(0.68_0.22_260_/_8%)_45%,transparent_72%)]",
  sage: "bg-[radial-gradient(circle_at_center,oklch(0.71_0.14_157_/_22%)_0%,oklch(0.71_0.14_157_/_6%)_45%,transparent_72%)]",
  amber:
    "bg-[radial-gradient(circle_at_center,oklch(0.84_0.16_93_/_24%)_0%,oklch(0.84_0.16_93_/_6%)_45%,transparent_72%)]",
};

export function WarmGlow({
  position = "top-right",
  size = "lg",
  hue = "apricot",
  className,
}: {
  position?: Position;
  size?: Size;
  hue?: Hue;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-10 rounded-full blur-3xl",
        POSITION[position],
        SIZE[size],
        HUE[hue],
        className,
      )}
    />
  );
}
