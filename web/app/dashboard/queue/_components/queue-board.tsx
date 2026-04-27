"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/app/_components/score-ring";
import { Topbar } from "@/app/_components/topbar";
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

      <div className="relative mx-auto max-w-[820px] px-4 pt-8 pb-32 md:px-6 md:pt-12">
        {/* Header */}
        <header className="hearth-enter bento-stage-1 mb-7">
          <Link
            href="/dashboard"
            className="press-feedback inline-flex w-fit items-center gap-1.5 rounded-sm py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to pipeline
          </Link>
          <div className="mt-5 label-caps text-muted-foreground">Apply session</div>
          <h1 className="mt-2.5 font-display italic text-[44px] leading-[1.04] tracking-tight md:text-[52px]">
            Queue.
          </h1>
          <p className="mt-3 max-w-[54ch] text-[14px] leading-relaxed text-muted-foreground">
            Open in batches, apply via Simplify, and the extension marks each as
            applied when you submit.
          </p>
        </header>

        {/* Segmented progress */}
        {totalForProgress > 0 && (
          <SegmentedProgress
            total={totalForProgress}
            applied={sessionApplied}
            cursor={cursor}
            opened={opened.size}
          />
        )}

        {/* Action bar */}
        <div className="hearth-enter bento-stage-2 mt-6 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openBatch}
            disabled={remaining === 0}
            className="press-feedback inline-flex h-9 items-center gap-2 rounded-md bg-apricot px-3.5 text-[13px] font-medium text-apricot-foreground shadow-[inset_0_1px_0_oklch(1_0_0/30%),0_4px_18px_-6px_oklch(0.886_0.052_53/55%)] disabled:pointer-events-none disabled:opacity-50"
          >
            <PlayCircle className="size-4" strokeWidth={1.75} />
            Open next {batchSize}
          </button>

          <div className="inline-flex items-center gap-0.5 rounded-md surface-sunken p-1">
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBatchSize(n)}
                className={cn(
                  "rounded-sm px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors duration-150",
                  batchSize === n
                    ? "bg-card text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/10%)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 font-mono text-[11px] tabular-nums text-muted-foreground">
            <span>
              <span className="text-foreground">{appliedToday + sessionApplied}</span>
              <span className="text-muted-foreground/60"> applied today</span>
            </span>
            <span className="hidden text-muted-foreground/40 sm:inline">·</span>
            <span className="hidden sm:inline">
              {remaining === 0 ? "—" : `${cursor + 1}/${remaining}`}
            </span>
          </div>
        </div>

        {/* List */}
        {remaining === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-5 flex flex-col gap-1.5">
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
                    "group/r relative flex items-start gap-4 rounded-md px-4 py-3.5 transition-[background-color,box-shadow] duration-200 ease-out md:px-5",
                    isCursor
                      ? "surface shadow-[inset_2px_0_0_var(--apricot),inset_0_0_0_1px_oklch(0.886_0.052_53/22%),0_2px_24px_-8px_oklch(0.886_0.052_53/30%)]"
                      : "bg-card/30 hover:bg-card/60",
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
                        className={cn(
                          "font-medium leading-snug tracking-tight transition-colors duration-200",
                          isCursor
                            ? "font-display italic text-[17px] text-foreground"
                            : "text-[15px] text-foreground hover:text-foreground/75",
                        )}
                      >
                        {item.job.title}
                      </a>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[13px] text-muted-foreground">
                        {item.job.company}
                      </span>
                      {wasOpened && <Badge tone="active">Opened</Badge>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground/85">
                      <span>{item.job.location || "—"}</span>
                      <Dot />
                      <span>{relTime(item.job.postedAt)}</span>
                      <Dot />
                      <span>{SOURCE_LABEL[item.job.source] ?? item.job.source}</span>
                    </div>
                    {isCursor && item.scoreReason && (
                      <p className="mt-2.5 max-w-[64ch] text-[12.5px] leading-relaxed text-muted-foreground/85">
                        {item.scoreReason}
                      </p>
                    )}
                  </div>

                  <div
                    className={cn(
                      "ml-auto flex shrink-0 items-center gap-1 transition-opacity duration-200",
                      isCursor ? "opacity-100" : "opacity-0 group-hover/r:opacity-100",
                    )}
                  >
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
      </div>

      {/* Floating keyboard dock */}
      {remaining > 0 && <KeyboardDock />}
    </div>
  );
}

function SegmentedProgress({
  total,
  applied,
  cursor,
  opened,
}: {
  total: number;
  applied: number;
  cursor: number;
  opened: number;
}) {
  return (
    <div className="hearth-enter bento-stage-1">
      <div className="flex h-1.5 gap-px overflow-hidden rounded-sm">
        {Array.from({ length: total }).map((_, i) => {
          const isApplied = i < applied;
          const isCursor = i === applied + cursor;
          return (
            <div
              key={i}
              className={cn(
                "h-full flex-1 transition-colors duration-300",
                isApplied
                  ? "bg-apricot"
                  : isCursor
                    ? "bg-apricot/40"
                    : "bg-foreground/8",
              )}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>
          <span className="text-foreground">{applied}</span>
          <span className="text-muted-foreground/60"> / {total} session</span>
        </span>
        <span>{opened} opened</span>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="size-0.5 rounded-full bg-muted-foreground/30" aria-hidden />
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
      title={`${label} (${shortcut})`}
      className={cn(
        "press-feedback inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-[background-color,color] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
        ghost
          ? "text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
          : tone === "apricot"
            ? "bg-apricot/30 text-foreground shadow-[inset_0_0_0_1px_oklch(0.886_0.052_53/45%)] hover:bg-apricot/45"
            : "surface-sunken text-foreground hover:brightness-105",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="size-3.5" strokeWidth={1.75} />
      )}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function KeyboardDock() {
  return (
    <div className="fixed bottom-6 left-1/2 z-30 hidden -translate-x-1/2 md:block">
      <div className="flex items-center gap-1.5 rounded-md surface px-3 py-2 text-[11px] text-muted-foreground shadow-[0_12px_32px_-12px_oklch(0_0_0/30%)]">
        <KeyPair k="J" label="↓" />
        <KeyPair k="K" label="↑" />
        <span className="mx-1 text-muted-foreground/40">·</span>
        <KeyPair k="O" label="open" />
        <KeyPair k="A" label="applied" />
        <KeyPair k="S" label="skip" />
        <KeyPair k="U" label="undo" />
      </div>
    </div>
  );
}

function KeyPair({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-card px-1.5 font-mono text-[10px] font-medium uppercase text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/10%),0_1px_2px_oklch(0_0_0/10%)]">
        {k}
      </kbd>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="hearth-enter bento-stage-2 mt-10 flex flex-col items-center justify-center gap-5 rounded-md border border-dashed border-foreground/12 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-md bg-sage/10">
        <CheckCircle2 className="size-5 text-sage" strokeWidth={1.5} />
      </span>
      <div>
        <div className="font-display italic text-2xl leading-snug">Inbox zero.</div>
        <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Your queue is clear. Add more roles from the pipeline to start a new
          apply session.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="press-feedback mt-1 inline-flex h-9 items-center gap-1.5 rounded-md surface-sunken px-3.5 text-[13px]"
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
