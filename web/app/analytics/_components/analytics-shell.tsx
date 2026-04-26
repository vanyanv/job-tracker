"use client";

import * as React from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Briefcase,
  Settings as SettingsIcon,
  TrendingUp,
  MessageSquare,
  Calendar,
  Target,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Emerald single-accent palette — different opacities for proportion charts
const EMERALD = "oklch(0.696 0.17 162.48)";
const EMERALD_SOFT = "oklch(0.696 0.17 162.48 / 0.55)";
const EMERALD_FAINT = "oklch(0.696 0.17 162.48 / 0.28)";
const NEUTRAL = "oklch(0.55 0 0 / 0.28)";

const CARD_CLS =
  "rounded-2xl border border-foreground/8 bg-card/40 ring-0 shadow-none gap-0 py-0 overflow-hidden";

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
  return (
    <div className="min-h-[100dvh] bg-background text-foreground antialiased">
      <Topbar user={user} />

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Insight
            </div>
            <h1 className="mt-2 text-3xl font-medium tracking-tighter md:text-4xl">
              Performance.
            </h1>
            <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
              {metrics.submitted === 0
                ? "Apply to a few jobs to start seeing your conversion data here."
                : `${metrics.submitted} applications tracked across the pipeline.`}
            </p>

            <Separator className="my-6 bg-foreground/5" />

            <div className="space-y-5">
              <KeyStat
                label="Last 7 days"
                value={metrics.last7}
                hint={metrics.last7 === 1 ? "application" : "applications"}
                icon={Calendar}
              />
              <KeyStat
                label="Response rate"
                value={`${Math.round(metrics.responseRate * 100)}%`}
                hint={`${metrics.totalInterview + metrics.totalRejected} of ${metrics.submitted}`}
                icon={MessageSquare}
              />
              <KeyStat
                label="Interview rate"
                value={`${Math.round(metrics.interviewRate * 100)}%`}
                hint={`${metrics.totalInterview} interview${metrics.totalInterview === 1 ? "" : "s"}`}
                icon={TrendingUp}
                accent={metrics.totalInterview > 0}
              />
              <KeyStat
                label="Avg applied score"
                value={metrics.avgAppliedScore == null ? "—" : metrics.avgAppliedScore}
                hint="across submitted apps"
                icon={Target}
              />
            </div>
          </aside>

          <main className="min-w-0 space-y-6">
            <VelocityCard data={velocity} />

            <FunnelCard metrics={metrics} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
              <HistogramCard data={histogram} />
              <SourceCard data={sources} />
            </div>

            <CompaniesCard data={topCompanies} />
          </main>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Velocity (AreaChart + Tabs) ---------------- */

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
    count: {
      label: "Applications",
      color: EMERALD,
    },
  } satisfies ChartConfig;

  return (
    <Card className={CARD_CLS}>
      <CardHeader className="flex flex-col gap-3 border-b border-foreground/5 px-6 py-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Volume
          </div>
          <CardTitle className="mt-1 text-base font-medium tracking-tight">
            Apply velocity
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            Daily application count
          </CardDescription>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as "7" | "30" | "90")}>
          <TabsList className="h-8 rounded-lg bg-foreground/[0.04] p-0.5">
            <TabsTrigger value="7" className="h-7 rounded-md px-2.5 text-xs">
              7d
            </TabsTrigger>
            <TabsTrigger value="30" className="h-7 rounded-md px-2.5 text-xs">
              30d
            </TabsTrigger>
            <TabsTrigger value="90" className="h-7 rounded-md px-2.5 text-xs">
              90d
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="px-2 pb-2 pt-4 sm:px-6 sm:pb-4">
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={filtered} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="velocity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EMERALD} stopOpacity={0.35} />
                <stop offset="95%" stopColor={EMERALD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="currentColor"
              strokeOpacity={0.06}
            />
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
              cursor={{ stroke: EMERALD_SOFT, strokeWidth: 1, strokeDasharray: "3 3" }}
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
              stroke={EMERALD}
              strokeWidth={1.6}
            />
          </AreaChart>
        </ChartContainer>

        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 border-t border-foreground/5 pt-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>
            Total <span className="ml-1.5 tabular-nums text-foreground">{total}</span>
          </span>
          <span>
            Avg/day <span className="ml-1.5 tabular-nums text-foreground">{avg.toFixed(1)}</span>
          </span>
          {peak && peak.count > 0 && (
            <span>
              Peak <span className="ml-1.5 tabular-nums text-foreground">{peak.count}</span>{" "}
              <span className="text-muted-foreground/60">on {shortDate(peak.date)}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Funnel (custom — conversion % between stages) ---------------- */

function FunnelCard({ metrics }: { metrics: Metrics }) {
  const stages = [
    { key: "ingested", label: "Ingested", value: metrics.totalAll, accent: false },
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
    <Card className={CARD_CLS}>
      <CardHeader className="flex flex-row items-baseline justify-between border-b border-foreground/5 px-6 py-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Conversion
          </div>
          <CardTitle className="mt-1 text-base font-medium tracking-tight">
            Pipeline funnel
          </CardTitle>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {metrics.totalAll} total
        </span>
      </CardHeader>
      <CardContent className="space-y-2.5 px-6 py-5">
        {stages.map((stage, i) => {
          const widthPct = Math.max(stage.value > 0 ? 4 : 0, (stage.value / max) * 100);
          const conv =
            i > 0 && stages[i - 1].value > 0
              ? (stage.value / stages[i - 1].value) * 100
              : null;
          return (
            <div key={stage.key}>
              <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wide">
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
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.04]">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    stage.accent ? "bg-emerald-500/70" : "bg-foreground/20",
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

/* ---------------- Score histogram (BarChart) ---------------- */

function HistogramCard({ data }: { data: HistoBucket[] }) {
  const total = data.reduce((a, b) => a + b.count, 0);

  const chartConfig = {
    count: { label: "Jobs" },
  } satisfies ChartConfig;

  return (
    <Card className={CARD_CLS}>
      <CardHeader className="border-b border-foreground/5 px-6 py-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Quality
        </div>
        <CardTitle className="mt-1 text-base font-medium tracking-tight">
          Score distribution
        </CardTitle>
        <CardDescription className="text-xs">
          Resume-fit scores across all ingested jobs
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-4 sm:px-6">
        {total === 0 ? (
          <EmptyHint>No scored jobs yet.</EmptyHint>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
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
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {data.map((d) => (
                  <Cell
                    key={d.label}
                    fill={d.min >= 80 ? EMERALD : "currentColor"}
                    fillOpacity={d.min >= 80 ? 0.85 : d.count === 0 ? 0.05 : 0.18}
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

/* ---------------- Sources (donut) ---------------- */

function SourceCard({ data }: { data: { source: string; count: number }[] }) {
  const total = React.useMemo(
    () => data.reduce((a, b) => a + b.count, 0),
    [data],
  );

  const chartData = data.map((d, i) => ({
    name: SOURCE_LABEL[d.source] ?? d.source,
    value: d.count,
    fill: i === 0 ? EMERALD : i === 1 ? EMERALD_SOFT : EMERALD_FAINT,
  }));

  const chartConfig = {
    value: { label: "Apps" },
  } satisfies ChartConfig;

  return (
    <Card className={cn(CARD_CLS, "flex flex-col")}>
      <CardHeader className="border-b border-foreground/5 px-6 py-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Source
        </div>
        <CardTitle className="mt-1 text-base font-medium tracking-tight">
          Where you applied
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-stretch px-6 pb-5 pt-4">
        {total === 0 ? (
          <EmptyHint>No applications yet.</EmptyHint>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-[200px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={84}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox))
                        return null;
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground font-mono text-2xl font-medium tabular-nums"
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 18}
                            className="fill-muted-foreground font-mono text-[9px] uppercase tracking-[0.16em]"
                          >
                            applied
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-4 space-y-2 border-t border-foreground/5 pt-3">
              {chartData.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wide"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: d.fill }}
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

/* ---------------- Top companies (divide-y list inside card) ---------------- */

function CompaniesCard({ data }: { data: { company: string; count: number }[] }) {
  return (
    <Card className={CARD_CLS}>
      <CardHeader className="border-b border-foreground/5 px-6 py-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Companies
        </div>
        <CardTitle className="mt-1 text-base font-medium tracking-tight">
          Most applied
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-2">
        {data.length === 0 ? (
          <div className="py-3">
            <EmptyHint>Once you apply, your most-targeted companies show here.</EmptyHint>
          </div>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {data.map((c) => (
              <li
                key={c.company}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="truncate pr-4 text-foreground">{c.company}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
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

/* ---------------- Shared ---------------- */

function KeyStat({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
          accent
            ? "border-emerald-700/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-foreground/10 bg-foreground/[0.02] text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "mt-0.5 font-mono text-2xl tabular-nums leading-none tracking-tight",
            accent ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-foreground/10 bg-foreground/[0.015] px-4 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Topbar({ user }: { user: DashboardUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-foreground/5 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md border border-foreground/10 bg-foreground/[0.03]">
            <Briefcase className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium tracking-tight">Job Tracker</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/dashboard">Pipeline</NavLink>
          <NavLink href="/dashboard/queue">Queue</NavLink>
          <NavLink href="/analytics" active>
            Analytics
          </NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="hidden items-center gap-2 rounded-full border border-foreground/8 bg-foreground/[0.015] px-2.5 py-1 transition-colors hover:bg-foreground/[0.04] sm:inline-flex"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-5 rounded-full" />
            ) : (
              <span className="flex size-5 items-center justify-center rounded-full bg-foreground/10 font-mono text-[10px] uppercase">
                {user.email.slice(0, 1)}
              </span>
            )}
            <span className="max-w-[140px] truncate text-xs text-muted-foreground">
              {user.email}
            </span>
            <SettingsIcon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-all",
        active
          ? "bg-foreground/[0.05] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
