"use client";

import * as React from "react";
import Link from "next/link";
import {
  Mail,
  FileText,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JobFeed, type FeedItem } from "./job-feed";
import { Topbar } from "@/app/_components/topbar";
import { StatTile } from "@/app/_components/stat-tile";

export type DashboardUser = {
  email: string;
  name: string | null;
  image: string | null;
  gmailConnected: boolean;
  hasResume: boolean;
  aiConfigured: boolean;
};

const STATUS_FILTERS: { id: string; label: string; values: string[] }[] = [
  { id: "active", label: "Active", values: ["new", "queued"] },
  { id: "new", label: "Inbox", values: ["new"] },
  { id: "queued", label: "Queued", values: ["queued"] },
  { id: "applied", label: "Applied", values: ["applied"] },
  { id: "interview", label: "Interview", values: ["interview"] },
  { id: "rejected", label: "Rejected", values: ["rejected"] },
  { id: "no_response", label: "Silent", values: ["no_response"] },
  { id: "skipped", label: "Skipped", values: ["skipped"] },
];

export function DashboardShell({
  user,
  countsByStatus,
  initialItems,
}: {
  user: DashboardUser;
  countsByStatus: Record<string, number>;
  initialItems: FeedItem[];
}) {
  const [activeFilter, setActiveFilter] = React.useState("active");
  const [counts, setCounts] = React.useState(countsByStatus);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const newCount = counts["new"] ?? 0;
  const queuedCount = counts["queued"] ?? 0;
  const interviewCount = counts["interview"] ?? 0;
  const appliedCount = counts["applied"] ?? 0;

  const setupComplete =
    user.aiConfigured && user.hasResume && user.gmailConnected;
  const setupDone = [user.aiConfigured, user.hasResume, user.gmailConnected].filter(
    Boolean,
  ).length;

  const activeValues = React.useMemo(
    () =>
      STATUS_FILTERS.find((f) => f.id === activeFilter)?.values ?? ["new", "queued"],
    [activeFilter],
  );

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <Topbar user={user} active="pipeline" />

      <div className="relative mx-auto max-w-[1400px] px-4 pt-8 pb-16 md:px-8 md:pt-10 md:pb-24">
        {/* Hero — greeter + KPIs in 2-up Bento */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
          {/* Greeter block (8 cols) */}
          <div className="hearth-enter bento-stage-1 md:col-span-8">
            <div className="label-caps text-muted-foreground">{dayLabel()}</div>
            <h1 className="mt-2.5 max-w-[20ch] font-display text-[40px] leading-[1.04] tracking-tight md:text-[56px]">
              <span className="text-foreground/95 not-italic font-medium">
                {greeting(user.name)}
              </span>
              <br />
              <span className="italic font-normal text-foreground/70">
                {heroSubject(newCount, total)}
              </span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-muted-foreground">
              {total === 0
                ? "No jobs ingested yet. The scraper runs every two hours — once your resume and AI provider are configured, fresh roles land here."
                : `${total} role${total === 1 ? "" : "s"} in your pipeline. ${newCount} arrived recently — scored, surfaced, and waiting on you.`}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {queuedCount > 0 ? (
                <Link
                  href="/dashboard/queue"
                  className="press-feedback inline-flex h-10 items-center justify-center gap-2.5 rounded-md bg-apricot px-4 text-[13.5px] font-medium text-apricot-foreground shadow-[inset_0_1px_0_oklch(1_0_0/35%),0_8px_24px_-10px_oklch(0.886_0.052_53/65%)] transition-[transform,filter] duration-200 ease-out hover:brightness-105"
                >
                  Start apply session
                  <span className="font-mono text-[11px] tabular-nums opacity-75">
                    {queuedCount}
                  </span>
                  <ArrowRight className="size-3.5" strokeWidth={2} />
                </Link>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Queue something from the feed below to start an apply session.
                </div>
              )}

              {!setupComplete && (
                <Link
                  href="/settings"
                  className="press-feedback inline-flex h-10 items-center gap-2 rounded-md surface-sunken px-3.5 text-[12.5px] text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground"
                >
                  <span className="size-1.5 rounded-full bg-amber-warm" />
                  <span>Complete setup</span>
                  <span className="font-mono tnum text-[11px] text-muted-foreground/60">
                    {setupDone}/3
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* KPI block (4 cols) — 2x2 grid */}
          <div className="grid grid-cols-2 gap-3 md:col-span-4">
            <StatTile
              label="Inbox"
              value={newCount}
              tone={newCount > 0 ? "apricot" : "default"}
              caption={newCount > 0 ? "Fresh & unscored" : "All caught up"}
              display
              delay={60}
              className="lift-on-hover"
            />
            <StatTile
              label="Queued"
              value={queuedCount}
              tone={queuedCount > 0 ? "cornflower" : "default"}
              caption={queuedCount > 0 ? "Ready to apply" : "Empty"}
              display
              delay={120}
              className="lift-on-hover"
            />
            <StatTile
              label="Applied"
              value={appliedCount}
              tone={appliedCount > 0 ? "sage" : "default"}
              caption="All time"
              display
              delay={180}
              className="lift-on-hover"
            />
            <StatTile
              label="Interview"
              value={interviewCount}
              tone={interviewCount > 0 ? "amber" : "default"}
              caption={interviewCount > 0 ? "Active conversations" : "Keep applying"}
              display
              delay={240}
              className="lift-on-hover"
            />
          </div>
        </section>

        {/* Filter chip rail */}
        <section className="hearth-enter bento-stage-3 mt-10 md:mt-12">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="flex min-w-max items-center gap-1.5">
              {STATUS_FILTERS.map((f) => {
                const c = f.values.reduce((sum, v) => sum + (counts[v] ?? 0), 0);
                const active = activeFilter === f.id;
                return (
                  <FilterChip
                    key={f.id}
                    active={active}
                    onClick={() => setActiveFilter(f.id)}
                    count={c}
                  >
                    {f.label}
                  </FilterChip>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feed + right rail */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <main className="min-w-0 lg:col-span-8">
            <JobFeed
              key={activeFilter}
              statuses={activeValues}
              initialItems={activeFilter === "active" ? initialItems : []}
              onCountsChange={setCounts}
            />
          </main>

          <aside className="flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-20 lg:self-start">
            <SetupBlock user={user} done={setupDone} />
            <QueuePreviewBlock queuedCount={queuedCount} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press-feedback inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150",
        active
          ? "border-apricot/40 bg-apricot/15 text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/12%)]"
          : "border-border bg-card/30 text-muted-foreground hover:border-foreground/15 hover:bg-card/60 hover:text-foreground",
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "font-mono text-[10.5px] tabular-nums",
          active ? "text-foreground/70" : "text-muted-foreground/60",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SetupBlock({
  user,
  done,
}: {
  user: DashboardUser;
  done: number;
}) {
  return (
    <div className="hearth-enter bento-stage-4 rounded-md surface p-5">
      <div className="flex items-center justify-between">
        <span className="label-caps text-muted-foreground">Setup</span>
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
          {done} / 3
        </span>
      </div>
      <div className="mt-3 flex gap-1">
        {[user.aiConfigured, user.hasResume, user.gmailConnected].map((ok, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-sm transition-colors duration-300",
              ok ? "bg-sage" : "bg-foreground/12",
            )}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        <SetupRow ok={user.aiConfigured} icon={Sparkles} label="AI provider" href="/settings" />
        <SetupRow ok={user.hasResume} icon={FileText} label="Resume parsed" href="/settings" />
        <SetupRow ok={user.gmailConnected} icon={Mail} label="Gmail sync" href="/settings?gmail=1" />
      </ul>
    </div>
  );
}

function QueuePreviewBlock({ queuedCount }: { queuedCount: number }) {
  return (
    <div className="hearth-enter bento-stage-5 relative overflow-hidden rounded-md bg-foreground p-5 text-background shadow-[inset_0_1px_0_oklch(1_0_0/8%),0_8px_28px_-12px_oklch(0_0_0/0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-apricot/18 blur-3xl"
      />
      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-background/55">
          Apply Session
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-background/55">
          {queuedCount} ready
        </span>
      </div>
      <p className="relative mt-3 text-[13px] leading-relaxed text-background/72">
        {queuedCount === 0
          ? "Queue jobs you want to apply to. Then run a focused, keyboard-driven session — open tabs in batches, mark as applied, move on."
          : `${queuedCount} role${queuedCount === 1 ? "" : "s"} queued. Open them in batches and apply with one keystroke.`}
      </p>
      {queuedCount > 0 && (
        <Link
          href="/dashboard/queue"
          className="press-feedback relative mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-apricot px-3.5 text-[12.5px] font-medium text-apricot-foreground transition-[filter,transform] duration-150 hover:brightness-105"
        >
          Start session
          <ArrowRight className="size-3.5" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

function dayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greeting(name: string | null): string {
  const first = (name ?? "").split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const tod =
    hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Afternoon" : "Evening";
  return first ? `${tod}, ${first}.` : `${tod}.`;
}

function heroSubject(newCount: number, total: number): string {
  if (total === 0) return "Nothing yet — scrape pending.";
  if (newCount === 0) return "Pipeline's quiet for now.";
  if (newCount === 1) return "One fresh role today — go.";
  return `${spellOut(newCount)} fresh today — go.`;
}

function spellOut(n: number): string {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = [
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (n < 10) return ones[n] ?? String(n);
  if (n < 20) return teens[n - 10] ?? String(n);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t]! : `${tens[t]}-${ones[o]}`;
  }
  return String(n);
}

function SetupRow({
  ok,
  icon: Icon,
  label,
  href,
}: {
  ok: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group/s flex items-center justify-between gap-2 text-[13px] transition-colors duration-150",
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2.5",
            ok ? "text-muted-foreground" : "text-muted-foreground group-hover/s:text-foreground",
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.75} />
          <span>{label}</span>
        </span>
        {ok ? (
          <CheckCircle2 className="size-3.5 text-sage" strokeWidth={2} />
        ) : (
          <ArrowRight
            className="size-3 text-muted-foreground/40 transition-transform duration-150 group-hover/s:translate-x-0.5 group-hover/s:text-muted-foreground"
            strokeWidth={2}
          />
        )}
      </Link>
    </li>
  );
}
