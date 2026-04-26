"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Keyboard,
  PlayCircle,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type QueueItem = {
  id: string;
  score: number | null;
  scoreReason: string | null;
  status: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
    source: string;
    postedAt: string;
  };
};

const SOURCE_LABEL: Record<string, string> = {
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
};

export function QueueBoard({
  user,
  initialItems,
  appliedToday,
}: {
  user: { email: string; name: string | null; image: string | null };
  initialItems: QueueItem[];
  appliedToday: number;
}) {
  const [items, setItems] = React.useState<QueueItem[]>(initialItems);
  const [cursor, setCursor] = React.useState(0);
  const [pending, setPending] = React.useState<Record<string, string>>({});
  const [opened, setOpened] = React.useState<Set<string>>(new Set());
  const [sessionApplied, setSessionApplied] = React.useState(0);
  const rowRefs = React.useRef<Record<string, HTMLLIElement | null>>({});
  const [batchSize, setBatchSize] = React.useState(5);

  const remaining = items.length;
  const cursorItem = items[cursor];

  React.useEffect(() => {
    if (cursor >= items.length) setCursor(Math.max(0, items.length - 1));
  }, [items.length, cursor]);

  React.useEffect(() => {
    const id = cursorItem?.id;
    if (!id) return;
    const el = rowRefs.current[id];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cursor, cursorItem?.id]);

  async function setStatus(id: string, next: "applied" | "skipped" | "new") {
    setPending((p) => ({ ...p, [id]: next }));
    try {
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (next === "applied") setSessionApplied((n) => n + 1);
    } catch {
      // could surface toast later
    } finally {
      setPending((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
    }
  }

  function openItem(item: QueueItem) {
    window.open(item.job.url, "_blank", "noopener,noreferrer");
    setOpened((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }

  function openBatch() {
    const slice = items.slice(0, batchSize);
    if (slice.length === 0) return;
    slice.forEach((it, i) => {
      // Stagger so popup blockers don't bundle them
      setTimeout(() => openItem(it), i * 110);
    });
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const item = items[cursor];
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setCursor((c) => Math.min(items.length - 1, c + 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setCursor((c) => Math.max(0, c - 1));
          break;
        case "o":
        case "Enter":
          if (item) {
            e.preventDefault();
            openItem(item);
          }
          break;
        case "a":
          if (item) {
            e.preventDefault();
            void setStatus(item.id, "applied");
          }
          break;
        case "s":
          if (item) {
            e.preventDefault();
            void setStatus(item.id, "skipped");
          }
          break;
        case "u":
          if (item) {
            e.preventDefault();
            void setStatus(item.id, "new");
          }
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, cursor]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground antialiased">
      <Topbar />

      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px] lg:gap-14">
          {/* Main column */}
          <main className="min-w-0">
            {/* Header */}
            <header className="flex flex-col gap-3 border-b border-foreground/5 pb-6">
              <Link
                href="/dashboard"
                className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" strokeWidth={2} />
                Pipeline
              </Link>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Apply session
                  </div>
                  <h1 className="mt-2 text-3xl font-medium tracking-tighter md:text-4xl">
                    Queue
                  </h1>
                  <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
                    Power through queued roles. Open in tabs, fill via Simplify, and the extension
                    will mark each as applied when you submit.
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                  <Stat label="Remaining" value={remaining} />
                  <Divider />
                  <Stat label="Today" value={appliedToday + sessionApplied} accent />
                  <Divider />
                  <Stat label="Opened" value={opened.size} />
                </div>
              </div>
            </header>

            {/* Action bar */}
            <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-foreground/5 bg-background/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8">
              <button
                type="button"
                onClick={openBatch}
                disabled={remaining === 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-700/15 bg-emerald-500/10 px-3.5 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/15 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 dark:text-emerald-400"
              >
                <PlayCircle className="size-4" strokeWidth={1.75} />
                Open next {batchSize}
              </button>

              <div className="inline-flex items-center gap-0 rounded-lg border border-foreground/10 bg-foreground/[0.015] p-0.5">
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBatchSize(n)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-mono text-[11px] tabular-nums transition-all",
                      batchSize === n
                        ? "bg-background text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <ShortcutHint />

              <div className="ml-auto text-[11px] text-muted-foreground">
                Cursor on{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {remaining === 0 ? "—" : `${cursor + 1}/${remaining}`}
                </span>
              </div>
            </div>

            {/* List */}
            {remaining === 0 ? (
              <EmptyState />
            ) : (
              <ul className="divide-y divide-foreground/5">
                {items.map((item, idx) => {
                  const isCursor = idx === cursor;
                  const wasOpened = opened.has(item.id);
                  const isPending = pending[item.id];
                  return (
                    <li
                      key={item.id}
                      ref={(el) => {
                        rowRefs.current[item.id] = el;
                      }}
                      onMouseEnter={() => setCursor(idx)}
                      className={cn(
                        "group/r relative flex items-start gap-4 px-4 py-5 transition-all",
                        "hover:bg-foreground/[0.012]",
                        isCursor && "bg-foreground/[0.025]",
                      )}
                    >
                      {isCursor && (
                        <span className="absolute left-0 top-0 h-full w-[2px] bg-foreground transition-all" />
                      )}

                      <ScoreBadge score={item.score ?? 0} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <a
                            href={item.job.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => {
                              setOpened((prev) => {
                                const next = new Set(prev);
                                next.add(item.id);
                                return next;
                              });
                            }}
                            className="text-[15px] font-medium leading-snug tracking-tight text-foreground transition-colors hover:text-foreground/70"
                          >
                            {item.job.title}
                          </a>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-sm text-muted-foreground">{item.job.company}</span>
                          {wasOpened && <Badge tone="active">Opened</Badge>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/80">
                          <span>{item.job.location || "—"}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" strokeWidth={1.75} />
                            {relTime(item.job.postedAt)}
                          </span>
                          <span>{SOURCE_LABEL[item.job.source] ?? item.job.source}</span>
                        </div>
                        {item.scoreReason && (
                          <p className="mt-2 max-w-[64ch] text-xs leading-relaxed text-muted-foreground/85">
                            {item.scoreReason}
                          </p>
                        )}
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <RowAction
                          onClick={() => openItem(item)}
                          icon={ExternalLink}
                          label="Open"
                          shortcut="O"
                        />
                        <RowAction
                          onClick={() => setStatus(item.id, "applied")}
                          icon={CheckCircle2}
                          label="Applied"
                          shortcut="A"
                          tone="emerald"
                          pending={isPending === "applied"}
                        />
                        <RowAction
                          onClick={() => setStatus(item.id, "skipped")}
                          icon={XCircle}
                          label="Skip"
                          shortcut="S"
                          ghost
                          pending={isPending === "skipped"}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </main>

          {/* Right rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-foreground/8 bg-foreground/[0.015] p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Flow
              </div>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed">
                <Step n={1} label="Open in batch" detail="Stagger up to 10 tabs at once." />
                <Step n={2} label="Apply via Simplify" detail="Auto-fill in each ATS form." />
                <Step
                  n={3}
                  label="Extension marks applied"
                  detail="Detects confirmation page; you'll see a Chrome notification."
                />
                <Step
                  n={4}
                  label="Item disappears"
                  detail="Refresh this page to pick up extension-marked rows."
                />
              </ol>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-foreground/15 bg-transparent p-5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md border border-foreground/10 bg-background">
                  <Layers className="size-3.5 text-foreground/70" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-sm font-medium leading-none">Session</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {sessionApplied} applied · {opened.size} opened
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-foreground/5 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/dashboard" className="text-sm font-medium tracking-tight">
          Job Tracker
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all hover:bg-foreground/[0.04] hover:text-foreground"
          >
            Pipeline
          </Link>
          <span className="rounded-md bg-foreground/[0.05] px-3 py-1.5 text-sm text-foreground">
            Queue
          </span>
          <Link
            href="/settings"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all hover:bg-foreground/[0.04] hover:text-foreground"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span
        className={cn(
          "text-lg font-semibold tracking-tight",
          accent ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-7 w-px bg-foreground/10" />;
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-emerald-700/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : score >= 60
        ? "border-foreground/15 bg-foreground/[0.04] text-foreground"
        : score > 0
          ? "border-foreground/8 bg-foreground/[0.02] text-muted-foreground"
          : "border-dashed border-foreground/10 bg-transparent text-muted-foreground/60";
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border font-mono leading-none tabular-nums transition-colors",
        tone,
      )}
    >
      <span className="text-base font-semibold tracking-tight">{score || "—"}</span>
      <span className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-muted-foreground/70">
        score
      </span>
    </div>
  );
}

function RowAction({
  onClick,
  icon: Icon,
  label,
  shortcut,
  tone,
  ghost,
  pending,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  shortcut: string;
  tone?: "emerald";
  ghost?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "group/a relative inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-all active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        ghost
          ? "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
          : tone === "emerald"
            ? "border border-emerald-700/15 bg-emerald-500/[0.06] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            : "border border-foreground/10 bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.06]",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="size-3" strokeWidth={1.75} />
      )}
      <span className="hidden sm:inline">{label}</span>
      <kbd className="ml-1 hidden rounded bg-foreground/[0.06] px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:inline">
        {shortcut}
      </kbd>
    </button>
  );
}

function ShortcutHint() {
  return (
    <div className="hidden items-center gap-2 rounded-lg border border-foreground/8 bg-foreground/[0.015] px-2.5 py-1.5 text-[11px] text-muted-foreground md:flex">
      <Keyboard className="size-3" strokeWidth={1.75} />
      <span className="flex items-center gap-1.5">
        <Key>J</Key>
        <Key>K</Key>
        navigate
        <span className="mx-1 text-muted-foreground/30">·</span>
        <Key>O</Key>
        open
        <span className="mx-1 text-muted-foreground/30">·</span>
        <Key>A</Key>
        applied
        <span className="mx-1 text-muted-foreground/30">·</span>
        <Key>S</Key>
        skip
      </span>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded bg-background px-1 py-px font-mono text-[10px] uppercase tracking-wider text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]">
      {children}
    </kbd>
  );
}

function Step({ n, label, detail }: { n: number; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-foreground/10 bg-background font-mono text-[10px] tabular-nums text-muted-foreground">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-tight">{label}</div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.01] px-6 py-16 text-center">
      <div>
        <div className="text-base font-medium tracking-tight">Queue is empty</div>
        <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-muted-foreground">
          Add jobs to your queue from the pipeline. High-score roles appear here ready for a focused
          apply session.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 text-xs transition-all hover:bg-foreground/[0.06] active:translate-y-px"
      >
        Back to pipeline
      </Link>
    </div>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "—";
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
