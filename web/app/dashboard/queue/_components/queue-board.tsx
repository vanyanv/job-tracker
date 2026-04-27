"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Keyboard,
  PlayCircle,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/app/_components/score-ring";
import { Topbar } from "@/app/_components/topbar";
import { WarmGlow } from "@/app/_components/warm-glow";
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
  const totalForProgress = remaining + sessionApplied;

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
      // swallow
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
      setTimeout(() => openItem(it), i * 110);
    });
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
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
    <div className="relative min-h-dvh bg-background text-foreground">
      <Topbar user={user} active="queue" />

      <div className="relative mx-auto max-w-[1200px] px-4 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24">
        <WarmGlow position="top-right" size="lg" hue="apricot" />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px] lg:gap-14">
          <main className="min-w-0">
            {/* Hero */}
            <header className="mb-9">
              <Link
                href="/dashboard"
                className="inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" strokeWidth={2} />
                Pipeline
              </Link>
              <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Apply session
              </div>
              <h1 className="hearth-enter mt-3 font-display text-[44px] leading-[1.04] tracking-tight md:text-[56px]">
                Queue.
              </h1>
              <p className="mt-4 max-w-[54ch] text-[14px] leading-relaxed text-muted-foreground">
                Power through queued roles. Open in tabs, fill via Simplify, and
                the extension will mark each as applied when you submit.
              </p>

              {/* Progress + stats */}
              <div className="mt-7 grid grid-cols-3 gap-3 md:max-w-[480px]">
                <SessionStat label="Remaining" value={remaining} />
                <SessionStat label="Today" value={appliedToday + sessionApplied} tone="apricot" />
                <SessionStat label="Opened" value={opened.size} />
              </div>

              {totalForProgress > 0 && (
                <div className="mt-5 max-w-[480px]">
                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
                    <div
                      className="h-full bg-apricot transition-[width] duration-500 ease-out"
                      style={{
                        width: `${
                          (sessionApplied / Math.max(1, totalForProgress)) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    {sessionApplied} of {totalForProgress} this session
                  </p>
                </div>
              )}
            </header>

            {/* Action bar */}
            <div className="sticky top-16 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-3 surface-elevated border-b divider-warm px-4 py-3 md:-mx-8 md:px-8">
              <button
                type="button"
                onClick={openBatch}
                disabled={remaining === 0}
                className="press-feedback inline-flex h-9 items-center gap-2 rounded-full bg-apricot px-4 text-sm font-medium text-apricot-foreground shadow-[inset_0_1px_0_oklch(1_0_0/24%),0_4px_18px_-6px_oklch(0.78_0.13_55/45%)] disabled:pointer-events-none disabled:opacity-50"
              >
                <PlayCircle className="size-4" strokeWidth={1.75} />
                Open next {batchSize}
              </button>

              <div className="inline-flex items-center gap-0.5 rounded-full surface-sunken p-1">
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBatchSize(n)}
                    className={cn(
                      "rounded-full px-3 py-1 font-mono text-[11px] tabular-nums transition-colors duration-150",
                      batchSize === n
                        ? "bg-card text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/8%)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <ShortcutHint />

              <div className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {remaining === 0 ? "—" : `${cursor + 1}/${remaining}`}
              </div>
            </div>

            {/* List */}
            {remaining === 0 ? (
              <EmptyState />
            ) : (
              <ul className="flex flex-col gap-2">
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
                        "group/r relative flex items-start gap-4 rounded-2xl px-4 py-4 transition-[background-color,box-shadow] duration-200 ease-out md:px-5",
                        isCursor
                          ? "surface shadow-[inset_0_0_0_1px_oklch(0.78_0.13_55/22%),0_2px_24px_-8px_oklch(0.78_0.13_55/30%)]"
                          : "bg-foreground/[0.012] hover:bg-foreground/[0.025]",
                      )}
                    >
                      <ScoreRing score={item.score ?? 0} size="md" className="mt-0.5" />

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
                            className="font-display text-[16px] font-medium leading-snug tracking-tight text-foreground transition-colors duration-200 hover:text-foreground/75"
                          >
                            {item.job.title}
                          </a>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-[13.5px] text-muted-foreground">
                            {item.job.company}
                          </span>
                          {wasOpened && <Badge tone="active">Opened</Badge>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/85">
                          <span>{item.job.location || "—"}</span>
                          <Dot />
                          <span>{relTime(item.job.postedAt)}</span>
                          <Dot />
                          <span>{SOURCE_LABEL[item.job.source] ?? item.job.source}</span>
                        </div>
                        {item.scoreReason && (
                          <p className="mt-2.5 max-w-[64ch] text-[12.5px] leading-relaxed text-muted-foreground/85">
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
                          tone="apricot"
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
            <div className="rounded-2xl surface px-5 py-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Flow
              </div>
              <ol className="mt-4 space-y-3.5 text-sm leading-relaxed">
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

            <div className="mt-5 rounded-2xl border border-dashed border-foreground/12 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl surface-sunken">
                  <Layers className="size-4 text-foreground/70" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-[13px] font-medium leading-none">Session</div>
                  <div className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
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

function Dot() {
  return (
    <span className="size-0.5 rounded-full bg-muted-foreground/30" aria-hidden />
  );
}

function SessionStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "apricot";
}) {
  return (
    <div className="rounded-2xl surface px-3.5 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-display text-2xl leading-none tracking-tight tabular-nums",
          tone === "apricot" ? "text-apricot" : "text-foreground",
        )}
      >
        {value}
      </div>
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
  tone?: "apricot";
  ghost?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "press-feedback inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-[background-color,color] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
        ghost
          ? "text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
          : tone === "apricot"
            ? "bg-apricot/12 text-apricot shadow-[inset_0_0_0_1px_oklch(0.78_0.13_55/22%)] hover:bg-apricot/18"
            : "surface-sunken text-foreground hover:brightness-110",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="size-3.5" strokeWidth={1.75} />
      )}
      <span className="hidden sm:inline">{label}</span>
      <kbd className="ml-1 hidden rounded-md bg-foreground/8 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:inline">
        {shortcut}
      </kbd>
    </button>
  );
}

function ShortcutHint() {
  return (
    <div className="hidden items-center gap-2 rounded-full surface-sunken px-3 py-1.5 text-[11px] text-muted-foreground md:flex">
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
    <kbd className="rounded-md bg-card px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/8%)]">
      {children}
    </kbd>
  );
}

function Step({ n, label, detail }: { n: number; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-apricot/10 font-mono text-[10px] font-medium tabular-nums text-apricot">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-tight">{label}</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-foreground/12 bg-foreground/[0.012] px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl surface-sunken">
        <PlayCircle
          className="size-5 text-muted-foreground"
          strokeWidth={1.5}
        />
      </span>
      <div>
        <div className="font-display text-xl leading-snug">Queue is empty</div>
        <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Add jobs from the pipeline. High-score roles appear here ready for a
          focused apply session.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="press-feedback mt-2 inline-flex h-9 items-center gap-1.5 rounded-full surface-sunken px-4 text-[13px]"
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
