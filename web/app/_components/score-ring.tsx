import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const DIM: Record<Size, { box: number; r: number; stroke: number; font: string }> = {
  sm: { box: 36, r: 14, stroke: 2.5, font: "text-[11px]" },
  md: { box: 44, r: 18, stroke: 3, font: "text-[13px]" },
  lg: { box: 64, r: 26, stroke: 4, font: "text-lg" },
};

export function ScoreRing({
  score,
  size = "md",
  gapDegrees = 0,
  className,
}: {
  score: number | null;
  size?: Size;
  gapDegrees?: number;
  className?: string;
}) {
  const { box, r, stroke, font } = DIM[size];
  const safe = Math.max(0, Math.min(100, score ?? 0));
  const arcDegrees = 360 - gapDegrees;
  const fullArcLen = (arcDegrees / 360) * 2 * Math.PI * r;
  const circumference = 2 * Math.PI * r;
  const trackDash = `${fullArcLen} ${circumference}`;
  const progressLen = (safe / 100) * fullArcLen;
  const progressDash = `${progressLen} ${circumference}`;
  const rotation = -90 + gapDegrees / 2;
  const offset = circumference - (safe / 100) * circumference;

  const tone =
    safe >= 80
      ? "text-[var(--apricot)]"
      : safe >= 60
        ? "text-[var(--sage)]"
        : safe > 0
          ? "text-muted-foreground"
          : "text-muted-foreground/50";

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: box, height: box }}
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        className={cn("absolute inset-0", tone)}
        style={{ transform: `rotate(${rotation}deg)` }}
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={stroke}
          strokeDasharray={trackDash}
          strokeLinecap={gapDegrees > 0 ? "round" : "butt"}
        />
        {/* Progress */}
        {safe > 0 &&
          (gapDegrees > 0 ? (
            <circle
              cx={box / 2}
              cy={box / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={progressDash}
            />
          ) : (
            <circle
              cx={box / 2}
              cy={box / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              className="score-ring-track"
              style={
                {
                  "--score-ring-empty": circumference,
                  "--score-ring-target": offset,
                } as React.CSSProperties
              }
            />
          ))}
      </svg>
      <span
        className={cn(
          "relative z-10 font-mono font-semibold tabular-nums leading-none tracking-tight",
          font,
          safe >= 80
            ? "text-[var(--apricot)]"
            : safe >= 60
              ? "text-[var(--sage)]"
              : safe > 0
                ? "text-foreground"
                : "text-muted-foreground/60",
        )}
      >
        {safe > 0 ? safe : "—"}
      </span>
    </div>
  );
}
