"use client";

import * as React from "react";
import Link from "next/link";
import {
  Mail,
  FileText,
  Sparkles,
  CheckCircle2,
  CircleDashed,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JobFeed, type FeedItem } from "./job-feed";
import { Topbar } from "@/app/_components/topbar";
import { WarmGlow } from "@/app/_components/warm-glow";
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

  const activeValues = React.useMemo(
    () => STATUS_FILTERS.find((f) => f.id === activeFilter)?.values ?? ["new", "queued"],
    [activeFilter],
  );

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <Topbar user={user} active="pipeline" />

      <div className="relative mx-auto max-w-[1400px] px-4 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24">
        {/* Hero block */}
        <section className="relative mb-12 md:mb-16">
          <WarmGlow position="top-right" size="xl" hue="apricot" />
          <WarmGlow position="top-left" size="md" hue="sage" className="opacity-50" />

          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {dayLabel()}
          </div>
          <h1 className="hearth-enter mt-3 max-w-[18ch] font-display text-[44px] leading-[1.04] tracking-tight md:text-[64px]">
            <span className="text-foreground/95">{greeting(user.name)}</span>
            <br />
            <span className="italic font-light text-foreground/65">
              {heroSubject(newCount, total)}
            </span>
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
            {total === 0
              ? "No jobs ingested yet. The scraper runs every two hours — once your resume and AI provider are configured, fresh roles land here."
              : `${total} role${total === 1 ? "" : "s"} in your pipeline. ${newCount} arrived recently — scored, surfaced, and waiting on you.`}
          </p>

          {/* Stat tiles */}
          <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatTile
              label="Inbox"
              value={newCount}
              tone={newCount > 0 ? "apricot" : "default"}
              caption={newCount > 0 ? "Fresh & unscored" : "All caught up"}
              display
              delay={0}
            />
            <StatTile
              label="Queued"
              value={queuedCount}
              tone="default"
              caption={queuedCount > 0 ? "Ready to apply" : "Empty"}
              display
              delay={45}
            />
            <StatTile
              label="Applied"
              value={appliedCount}
              tone={appliedCount > 0 ? "sage" : "default"}
              caption="All time"
              display
              delay={90}
            />
            <StatTile
              label="Interview"
              value={interviewCount}
              tone={interviewCount > 0 ? "amber" : "default"}
              caption={interviewCount > 0 ? "Active conversations" : "Keep applying"}
              display
              delay={135}
            />
          </div>

          {/* CTA + setup */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            {queuedCount > 0 ? (
              <Link
                href="/dashboard/queue"
                className="press-feedback inline-flex h-11 items-center justify-center gap-2.5 rounded-full bg-apricot px-5 text-sm font-medium text-apricot-foreground shadow-[inset_0_1px_0_oklch(1_0_0/28%),0_8px_28px_-10px_oklch(0.78_0.13_55/55%)] transition-[transform,filter] duration-200 ease-out hover:brightness-110"
              >
                Start apply session
                <span className="font-mono text-[11px] tabular-nums opacity-80">
                  {queuedCount}
                </span>
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground">
                Queue something from your feed to start an apply session.
              </div>
            )}

            {!setupComplete && (
              <SetupHint user={user} />
            )}
          </div>
        </section>

        {/* Filter rail + feed */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[230px_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Filter
            </div>
            <nav className="mt-4 flex flex-col gap-0.5">
              {STATUS_FILTERS.map((f) => {
                const c = f.values.reduce((sum, v) => sum + (counts[v] ?? 0), 0);
                const active = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={cn(
                      "press-feedback group/f flex items-center justify-between rounded-xl px-3 py-2 text-left",
                      active
                        ? "bg-foreground/[0.045] text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/4%)]"
                        : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full transition-colors duration-150",
                          active
                            ? "bg-apricot"
                            : "bg-foreground/25 group-hover/f:bg-foreground/45",
                        )}
                      />
                      <span className="text-[13px] leading-none">{f.label}</span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        active ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {c}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-10 border-t divider-warm pt-5">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Setup
                </div>
                <div className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  {[user.aiConfigured, user.hasResume, user.gmailConnected].filter(Boolean).length} / 3
                </div>
              </div>
              <div className="mt-2.5 flex gap-1">
                {[user.aiConfigured, user.hasResume, user.gmailConnected].map((ok, i) => (
                  <div key={i} className={cn(
                    "h-0.75 flex-1 rounded-full transition-colors duration-300",
                    ok ? "bg-sage" : "bg-foreground/12",
                  )} />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                <SetupRow
                  ok={user.aiConfigured}
                  icon={Sparkles}
                  label="AI provider"
                  href="/settings"
                />
                <SetupRow
                  ok={user.hasResume}
                  icon={FileText}
                  label="Resume parsed"
                  href="/settings"
                />
                <SetupRow
                  ok={user.gmailConnected}
                  icon={Mail}
                  label="Gmail sync"
                  href="/settings?gmail=1"
                />
              </ul>
            </div>
          </aside>

          <main className="min-w-0">
            <JobFeed
              key={activeFilter}
              statuses={activeValues}
              initialItems={activeFilter === "active" ? initialItems : []}
              onCountsChange={setCounts}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

function dayLabel(): string {
  return new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toLowerCase();
}

function greeting(name: string | null): string {
  const first = (name ?? "").split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const tod =
    hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return first ? `${tod}, ${first}.` : `${tod}.`;
}

function heroSubject(newCount: number, total: number): string {
  if (total === 0) return "Nothing yet — scrape pending.";
  if (newCount === 0) return "Pipeline's quiet for now.";
  if (newCount === 1) return "One fresh role today.";
  return `${spellOut(newCount)} fresh today.`;
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

function SetupHint({ user }: { user: DashboardUser }) {
  const completed = [user.aiConfigured, user.hasResume, user.gmailConnected].filter(Boolean).length;
  if (completed === 3) return null;
  return (
    <Link
      href="/settings"
      className="press-feedback inline-flex h-10 items-center gap-2 rounded-full surface-sunken px-4 text-[13px] text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground"
    >
      <span className="size-1.5 rounded-full bg-amber-warm" />
      <span>Complete setup</span>
      <span className="text-muted-foreground/60">{completed} of 3 done</span>
    </Link>
  );
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
          !ok && "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className={cn(
          "flex items-center gap-2.5",
          ok ? "text-muted-foreground" : "text-muted-foreground group-hover/s:text-foreground",
        )}>
          <Icon className="size-3.5" strokeWidth={1.75} />
          <span>{label}</span>
        </span>
        {ok ? (
          <CheckCircle2 className="size-3.5 text-sage" strokeWidth={2} />
        ) : (
          <ArrowRight className="size-3 text-muted-foreground/40 transition-transform duration-150 group-hover/s:translate-x-0.5 group-hover/s:text-muted-foreground" strokeWidth={2} />
        )}
      </Link>
    </li>
  );
}
