"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Topbar } from "@/app/_components/topbar";
import { cn } from "@/lib/utils";

type DashboardUser = {
  email: string;
  name: string | null;
  image: string | null;
};

type Metrics = {
  totalAll: number;
  totalNew: number;
  totalQueued: number;
  totalApplied: number;
  totalInterview: number;
  totalRejected: number;
  totalNoResponse: number;
  totalSkipped: number;
  submitted: number;
  responseRate: number;
  interviewRate: number;
  avgAppliedScore: number | null;
  last7: number;
};

type Bucket = { date: string; count: number };
type HistoBucket = { label: string; min: number; max: number; count: number };

const SOURCE_LABEL: Record<string, string> = {
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
};

const APRICOT = "var(--apricot)";
const SAGE = "var(--sage)";
const CORNFLOWER = "var(--cornflower)";

export function AnalyticsShell({
  user,
  metrics,
  velocity,
  histogram,
  sources,
  topCompanies,
}: {
  user: DashboardUser;
  metrics: Metrics;
  velocity: Bucket[];
  histogram: HistoBucket[];
  sources: { source: string; count: number }[];
  topCompanies: { company: string; count: number }[];
}) {
  const responsePct = Math.round(metrics.responseRate * 100);
  const interviewPct = Math.round(metrics.interviewRate * 100);

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <Topbar user={user} active="analytics" />

      <div className="relative mx-auto max-w-[1280px] px-4 pt-8 pb-16 md:px-8 md:pt-12 md:pb-24">
        {/* Editorial KPI hero — two oversized stats divided by hairline */}
        <section className="hearth-enter bento-stage-1">
          <div className="label-caps text-muted-foreground">
            Performance · last 90 days
          </div>

          <div className="mt-6 grid grid-cols-1 gap-y-8 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-x-10">
            <KpiHero
              value={responsePct}
              suffix="%"
              label="Response rate"
              accent="apricot"
              subtitle={
                metrics.submitted === 0
                  ? "Apply to start tracking conversion."
                  : `${metrics.totalInterview + metrics.totalRejected} replies · ${metrics.submitted} submitted`
              }
            />
            <KpiGauge
              value={interviewPct}
              accent="cornflower"
              label="Interview rate"
              caption={
                metrics.totalInterview === 0
                  ? "No interview conversions yet."
                  : `${metrics.totalInterview} interview${metrics.totalInterview === 1 ? "" : "s"} so far`
              }
            />
          </div>
        </section>

        {/* Secondary KPI bento — 4 small tiles */}
        <section className="hearth-enter bento-stage-2 mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SmallKpi label="Last 7 days" value={metrics.last7} accent="apricot" caption={metrics.last7 === 1 ? "application" : "applications"} />
          <SmallKpi label="Submitted" value={metrics.submitted} accent="sage" caption="all time" />
          <SmallKpi
            label="Avg score"
            value={metrics.avgAppliedScore == null ? "—" : metrics.avgAppliedScore}
            accent="cornflower"
            caption="across submitted"
          />
          <SmallKpi label="Pipeline" value={metrics.totalAll} caption="ingested all time" />
        </section>

        {/* Velocity full-width */}
        <section className="hearth-enter bento-stage-3 mt-10">
          <VelocityCard data={velocity} />
        </section>

        {/* Funnel + 3-up bento below */}
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="hearth-enter bento-stage-4 md:col-span-12">
            <FunnelCard metrics={metrics} />
          </div>

          <div className="hearth-enter bento-stage-5 md:col-span-7">
            <HistogramCard data={histogram} />
          </div>
          <div className="hearth-enter bento-stage-5 md:col-span-5">
            <SourceCard data={sources} />
          </div>

          <div className="hearth-enter bento-stage-6 md:col-span-12">
            <CompaniesCard data={topCompanies} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Hero KPI ── */

function KpiHero({
  value,
  suffix,
  label,
  subtitle,
  accent,
}: {
  value: number | string;
  suffix?: string;
  label: string;
  subtitle: string;
  accent: "apricot" | "amber" | "sage" | "cornflower";
}) {
  const tone =
    accent === "apricot"
      ? "text-foreground"
      : accent === "cornflower"
        ? "text-[var(--cornflower)]"
        : accent === "amber"
          ? "text-amber-warm"
          : "text-sage";

  return (
    <div>
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-baseline">
        <span
          className={cn(
            "font-display italic font-medium leading-[0.92] tracking-tight tnum text-[88px] md:text-[112px]",
            tone,
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="ml-1 font-display italic text-[40px] text-foreground/45 md:text-[56px]">
            {suffix}
          </span>
        )}
      </div>
      <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

function KpiGauge({
  value,
  label,
  caption,
  accent,
}: {
  value: number;
  label: string;
  caption: string;
  accent: "apricot" | "cornflower" | "sage" | "amber";
}) {
  const safe = Math.max(0, Math.min(100, value));
  const size = 220;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const gapDeg = 90;
  const arcDeg = 360 - gapDeg;
  const circumference = 2 * Math.PI * r;
  const fullArc = (arcDeg / 360) * circumference;
  const progressLen = (safe / 100) * fullArc;
  const rotation = -90 + gapDeg / 2;

  const accentVar =
    accent === "apricot"
      ? "var(--apricot)"
      : accent === "cornflower"
        ? "var(--cornflower)"
        : accent === "sage"
          ? "var(--sage)"
          : "var(--amber-warm)";

  return (
    <div className="flex flex-col items-center md:items-start">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${label}: ${safe}%`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: `rotate(${rotation}deg)` }}
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fullArc} ${circumference}`}
          />
          {safe > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={accentVar}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${progressLen} ${circumference}`}
              className="kpi-gauge-fill"
              style={
                {
                  "--gauge-target": progressLen,
                  "--gauge-circ": circumference,
                } as React.CSSProperties
              }
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-baseline">
            <span className="font-display italic font-medium leading-none tracking-tight tnum text-foreground text-[64px]">
              {safe}
            </span>
            <span className="ml-0.5 font-display italic text-[26px] text-foreground/45">
              %
            </span>
          </div>
          <div className="mt-1 label-caps text-muted-foreground">{label}</div>
        </div>
      </div>
      <p className="mt-4 max-w-[34ch] text-center text-[14px] leading-relaxed text-muted-foreground md:text-left">
        {caption}
      </p>
    </div>
  );
}

function SmallKpi({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: number | string;
  caption?: string;
  accent?: "apricot" | "sage" | "amber" | "cornflower";
}) {
  const edge =
    accent === "apricot"
      ? "edge-highlight-apricot"
      : accent === "sage"
        ? "edge-highlight-sage"
        : accent === "amber"
          ? "edge-highlight-amber"
          : accent === "cornflower"
            ? "edge-highlight-cornflower"
            : "";
  return (
    <div className={cn("rounded-md surface px-4 py-3.5", edge)}>
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-mono text-[24px] font-medium leading-none tracking-tight tnum">
        {value}
      </div>
      {caption && (
        <div className="mt-1 text-[11px] text-muted-foreground/85">{caption}</div>
      )}
    </div>
  );
}

/* ── Velocity ── */

function VelocityCard({ data }: { data: Bucket[] }) {
  const [range, setRange] = React.useState<"7" | "30" | "90">("30");

  const filtered = React.useMemo(() => {
    const days = parseInt(range, 10);
    return data.slice(data.length - days);
  }, [data, range]);

  const total = filtered.reduce((a, b) => a + b.count, 0);
  const avg = total / Math.max(1, filtered.length);
  const peak = filtered.reduce((m, p) => (p.count > m.count ? p : m), filtered[0]);

  const chartConfig = {
    count: { label: "Applications", color: APRICOT },
  } satisfies ChartConfig;

  return (
    <Card className="overflow-hidden rounded-md">
      <CardHeader className="flex flex-col gap-3 border-b divider-warm pb-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Eyebrow>Volume</Eyebrow>
          <CardTitle className="mt-1 text-[15px]">Apply velocity</CardTitle>
          <CardDescription className="mt-0.5">
            Daily application count
          </CardDescription>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as "7" | "30" | "90")}>
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="px-2 pt-5 sm:px-5">
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <AreaChart data={filtered} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="velocity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={APRICOT} stopOpacity={0.45} />
                <stop offset="95%" stopColor={APRICOT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.06} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={36}
              tickFormatter={(value) =>
                new Date(value + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
              className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
            />
            <ChartTooltip
              cursor={{ stroke: APRICOT, strokeWidth: 1, strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) =>
                    new Date(value + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
              }
            />
            <Area
              dataKey="count"
              type="natural"
              fill="url(#velocity-fill)"
              stroke={APRICOT}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>

        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 border-t divider-warm pt-3 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
          <span>
            Total <span className="ml-1.5 tabular-nums text-foreground">{total}</span>
          </span>
          <span>
            Avg/day{" "}
            <span className="ml-1.5 tabular-nums text-foreground">{avg.toFixed(1)}</span>
          </span>
          {peak && peak.count > 0 && (
            <span>
              Peak{" "}
              <span className="ml-1.5 tabular-nums text-foreground">{peak.count}</span>{" "}
              <span className="text-muted-foreground/60">on {shortDate(peak.date)}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Funnel ── */

function FunnelCard({ metrics }: { metrics: Metrics }) {
  const stages = [
    { key: "ingested", label: "Ingested", value: metrics.totalAll, accent: false as boolean },
    {
      key: "queued",
      label: "Queued",
      value: metrics.totalQueued + metrics.submitted,
      accent: false,
      sub: `${metrics.totalQueued} pending`,
    },
    { key: "submitted", label: "Submitted", value: metrics.submitted, accent: false },
    {
      key: "responded",
      label: "Responded",
      value: metrics.totalInterview + metrics.totalRejected,
      accent: false,
      sub: `${metrics.totalNoResponse} silent`,
    },
    { key: "interview", label: "Interview", value: metrics.totalInterview, accent: true },
  ];

  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-baseline justify-between border-b divider-warm pb-5">
        <div>
          <Eyebrow>Conversion</Eyebrow>
          <CardTitle className="mt-1 text-[15px]">Pipeline funnel</CardTitle>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
          {metrics.totalAll} total
        </span>
      </CardHeader>
      <CardContent className="space-y-3.5 pt-5 pb-5">
        {stages.map((stage, i) => {
          const widthPct = Math.max(stage.value > 0 ? 4 : 0, (stage.value / max) * 100);
          const conv =
            i > 0 && stages[i - 1]!.value > 0
              ? (stage.value / stages[i - 1]!.value) * 100
              : null;
          return (
            <div key={stage.key}>
              <div className="flex items-baseline justify-between font-mono text-[10.5px] uppercase tracking-[0.04em]">
                <span className="text-foreground">{stage.label}</span>
                <span className="flex items-baseline gap-3 text-muted-foreground/70">
                  {stage.sub && (
                    <span className="text-muted-foreground/60">{stage.sub}</span>
                  )}
                  {conv != null && stage.value > 0 && (
                    <span className="tabular-nums text-muted-foreground/60">
                      {conv.toFixed(0)}%
                    </span>
                  )}
                  <span className="tabular-nums text-foreground">{stage.value}</span>
                </span>
              </div>
              <div className="mt-2 h-3.5 overflow-hidden rounded-sm bg-foreground/4">
                <div
                  className={cn(
                    "h-full rounded-sm transition-[width] duration-700 ease-out",
                    stage.accent ? "bg-apricot" : "bg-foreground/22",
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ── Histogram ── */

function HistogramCard({ data }: { data: HistoBucket[] }) {
  const total = data.reduce((a, b) => a + b.count, 0);
  const chartConfig = {
    count: { label: "Jobs" },
  } satisfies ChartConfig;

  return (
    <Card className="h-full rounded-md">
      <CardHeader className="border-b divider-warm pb-5">
        <Eyebrow>Quality</Eyebrow>
        <CardTitle className="mt-1 text-[15px]">Score distribution</CardTitle>
        <CardDescription>
          Resume-fit scores across all ingested jobs
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-5 sm:px-5">
        {total === 0 ? (
          <EmptyHint>No scored jobs yet.</EmptyHint>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.06} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              />
              <YAxis hide />
              <ChartTooltip
                cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <span className="flex items-baseline gap-2">
                        <span className="text-muted-foreground">
                          {(item.payload as HistoBucket).label}
                        </span>
                        <span className="font-mono tabular-nums">{value}</span>
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
                {data.map((d) => (
                  <Cell
                    key={d.label}
                    fill={d.min >= 80 ? APRICOT : d.min >= 60 ? SAGE : "currentColor"}
                    fillOpacity={d.min >= 60 ? 0.85 : d.count === 0 ? 0.05 : 0.18}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Source ── */

function SourceCard({ data }: { data: { source: string; count: number }[] }) {
  const total = React.useMemo(
    () => data.reduce((a, b) => a + b.count, 0),
    [data],
  );

  const items = data.map((d, i) => ({
    name: SOURCE_LABEL[d.source] ?? d.source,
    value: d.count,
    color: i === 0 ? APRICOT : i === 1 ? CORNFLOWER : SAGE,
  }));

  return (
    <Card className="h-full rounded-md">
      <CardHeader className="border-b divider-warm pb-5">
        <Eyebrow>Source</Eyebrow>
        <CardTitle className="mt-1 text-[15px]">Where you applied</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 pb-5">
        {total === 0 ? (
          <EmptyHint>No applications yet.</EmptyHint>
        ) : (
          <>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-display italic text-[34px] font-medium tnum tracking-tight">
                {total}
              </span>
              <span className="label-caps text-muted-foreground">applied</span>
            </div>

            <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-foreground/[0.04]">
              {items.map((d) => (
                <div
                  key={d.name}
                  className="h-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${(d.value / total) * 100}%`,
                    background: d.color,
                  }}
                  title={`${d.name}: ${d.value}`}
                />
              ))}
            </div>

            <ul className="mt-5 space-y-2.5">
              {items.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.04em]"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="size-2 rounded-sm"
                      style={{ background: d.color }}
                    />
                    <span className="text-foreground">{d.name}</span>
                  </span>
                  <span className="flex items-baseline gap-3 text-muted-foreground">
                    <span className="text-muted-foreground/60">
                      {Math.round((d.value / total) * 100)}%
                    </span>
                    <span className="tabular-nums text-foreground">{d.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Companies ── */

function CompaniesCard({ data }: { data: { company: string; count: number }[] }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b divider-warm pb-5">
        <Eyebrow>Companies</Eyebrow>
        <CardTitle className="mt-1 text-[15px]">Most applied</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        {data.length === 0 ? (
          <div className="py-3">
            <EmptyHint>
              Once you apply, your most-targeted companies show here.
            </EmptyHint>
          </div>
        ) : (
          <ul className="divide-y divider-warm">
            {data.map((c) => (
              <li
                key={c.company}
                className="flex items-center justify-between py-3.5 text-sm"
              >
                <span className="truncate pr-4 text-foreground">{c.company}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {c.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Shared ── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="label-caps text-muted-foreground">{children}</div>;
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-foreground/12 px-4 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type { Metrics };
