"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Settings as SettingsIcon,
  Mail,
  FileText,
  Sparkles,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JobFeed, type FeedItem } from "./job-feed";

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

  const activeValues =
    STATUS_FILTERS.find((f) => f.id === activeFilter)?.values ?? ["new", "queued"];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground antialiased">
      <Topbar user={user} />

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
          {/* Left rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Pipeline
              </div>
              <h1 className="mt-2 text-3xl font-medium tracking-tighter md:text-4xl">
                {greeting(user.name)}
              </h1>
              <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
                {total === 0
                  ? "No jobs ingested yet — the scraper runs every two hours."
                  : `${total} jobs in your pipeline · ${newCount} fresh today`}
              </p>
            </div>

            {/* Stat pills */}
            <div className="mt-7 grid grid-cols-2 gap-2">
              <StatPill label="Inbox" value={newCount} accent />
              <StatPill label="Queued" value={queuedCount} />
              <StatPill label="Applied" value={appliedCount} />
              <StatPill label="Interview" value={interviewCount} accent={interviewCount > 0} />
            </div>

            {queuedCount > 0 && (
              <Link
                href="/dashboard/queue"
                className="mt-3 group/q flex items-center justify-between rounded-xl border border-emerald-700/15 bg-emerald-500/[0.06] px-3.5 py-2.5 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/10 active:translate-y-px dark:text-emerald-400"
              >
                <span>Start apply session</span>
                <span className="font-mono text-[11px] tabular-nums opacity-70 transition-transform group-hover/q:translate-x-0.5">
                  →
                </span>
              </Link>
            )}

            {/* Filter list */}
            <nav className="mt-8 flex flex-col gap-0.5 border-t border-foreground/5 pt-3">
              {STATUS_FILTERS.map((f) => {
                const c = f.values.reduce((sum, v) => sum + (counts[v] ?? 0), 0);
                const active = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={cn(
                      "group/f flex items-center justify-between rounded-md px-2.5 py-2 text-left transition-all",
                      "hover:bg-foreground/[0.04] active:translate-y-px",
                      active && "bg-foreground/[0.05]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm leading-none",
                        active
                          ? "font-medium text-foreground"
                          : "text-muted-foreground group-hover/f:text-foreground",
                      )}
                    >
                      {f.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        active ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {c}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Setup status — minimal, subdued */}
            <div className="mt-8 border-t border-foreground/5 pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Setup
              </div>
              <ul className="mt-3 space-y-2">
                <SetupRow ok={user.aiConfigured} icon={Sparkles} label="AI provider" href="/settings" />
                <SetupRow ok={user.hasResume} icon={FileText} label="Resume parsed" href="/settings" />
                <SetupRow
                  ok={user.gmailConnected}
                  icon={Mail}
                  label="Gmail sync"
                  href="/settings?gmail=1"
                />
              </ul>
            </div>
          </aside>

          {/* Feed column */}
          <main className="min-w-0">
            <JobFeed
              key={activeFilter}
              statuses={activeValues}
              initialItems={activeFilter === "active" ? initialItems : []}
              onCountsChange={(next) => setCounts(next)}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

function greeting(name: string | null): string {
  const first = (name ?? "").split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const tod = hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  return first ? `${tod}, ${first}.` : `${tod}.`;
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        accent
          ? "border-emerald-700/15 bg-emerald-500/[0.06]"
          : "border-foreground/8 bg-foreground/[0.015]",
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
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
    </div>
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
        className="group/s flex items-center justify-between gap-2 text-sm transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground group-hover/s:text-foreground">
          <Icon className="size-3.5" strokeWidth={1.75} />
          <span>{label}</span>
        </span>
        {ok ? (
          <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={2} />
        ) : (
          <CircleDashed className="size-3.5 text-muted-foreground/60" strokeWidth={2} />
        )}
      </Link>
    </li>
  );
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
          <NavLink href="/dashboard" active>
            Pipeline
          </NavLink>
          <NavLink href="/dashboard/queue">Queue</NavLink>
          <NavLink href="/analytics">Analytics</NavLink>
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
