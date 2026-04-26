"use client";

import * as React from "react";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  ListPlus,
  Calendar,
  Loader2,
  CornerDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeedItem } from "./job-feed";

const SOURCE_LABEL: Record<string, string> = {
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
};

export function JobRow({
  item,
  onChange,
}: {
  item: FeedItem;
  onChange: (id: string, patch: Partial<FeedItem>, removeFromList: boolean) => void;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  async function setStatus(next: string) {
    setPending(next);
    try {
      const res = await fetch(`/api/jobs/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = (await res.json()) as { status: string; appliedAt: string | null };
      const removeFromList = ["new", "queued"].includes(item.status) && !["new", "queued"].includes(next);
      onChange(item.id, { status: data.status, appliedAt: data.appliedAt }, removeFromList);
    } catch {
      // swallow — could surface toast later
    } finally {
      setPending(null);
    }
  }

  const score = item.score ?? 0;
  const scoreTone =
    score >= 80
      ? "score-high"
      : score >= 60
        ? "score-mid"
        : score > 0
          ? "score-low"
          : "score-none";

  return (
    <article className="group/row relative flex items-start gap-4 px-1 py-5 transition-colors hover:bg-foreground/[0.012]">
      {/* Score badge */}
      <ScoreBadge score={score} tone={scoreTone} />

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <a
            href={item.job.url}
            target="_blank"
            rel="noreferrer"
            className="text-[15px] font-medium leading-snug tracking-tight text-foreground transition-colors hover:text-foreground/70"
          >
            {item.job.title}
          </a>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm text-muted-foreground">{item.job.company}</span>
          <StatusChip status={item.status} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/80">
          <span>{item.job.location || "—"}</span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" strokeWidth={1.75} />
            {relTime(item.job.postedAt)}
          </span>
          <span>{SOURCE_LABEL[item.job.source] ?? item.job.source}</span>
          {item.scoreReason && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {expanded ? "Hide reason" : "Why this score"}
            </button>
          )}
        </div>

        {expanded && item.scoreReason && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-foreground/5 bg-foreground/[0.02] px-3 py-2.5 text-xs leading-relaxed text-foreground/75">
            <CornerDownRight
              className="mt-0.5 size-3 shrink-0 text-muted-foreground/60"
              strokeWidth={1.75}
            />
            <span className="font-normal normal-case tracking-normal">{item.scoreReason}</span>
          </p>
        )}

        {item.emailNote && (
          <p className="mt-3 rounded-lg border border-foreground/5 bg-foreground/[0.02] px-3 py-2 text-xs text-muted-foreground">
            {item.emailNote}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover/row:opacity-100">
        {item.status === "new" && (
          <ActionButton
            onClick={() => setStatus("queued")}
            pending={pending === "queued"}
            label="Queue"
            icon={ListPlus}
          />
        )}
        {(item.status === "new" || item.status === "queued") && (
          <ActionButton
            onClick={() => setStatus("applied")}
            pending={pending === "applied"}
            label="Mark applied"
            icon={CheckCircle2}
            tone="emerald"
          />
        )}
        {(item.status === "new" || item.status === "queued") && (
          <ActionButton
            onClick={() => setStatus("skipped")}
            pending={pending === "skipped"}
            label="Skip"
            icon={XCircle}
            ghost
          />
        )}
        <a
          href={item.job.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-foreground/[0.05] hover:text-foreground active:translate-y-px"
          title="Open posting"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
        </a>
      </div>
    </article>
  );
}

function ActionButton({
  onClick,
  pending,
  label,
  icon: Icon,
  tone,
  ghost,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: "emerald";
  ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={label}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-all active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
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
    </button>
  );
}

function ScoreBadge({ score, tone }: { score: number; tone: string }) {
  const ring =
    tone === "score-high"
      ? "border-emerald-700/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "score-mid"
        ? "border-foreground/15 bg-foreground/[0.04] text-foreground"
        : tone === "score-low"
          ? "border-foreground/8 bg-foreground/[0.02] text-muted-foreground"
          : "border-dashed border-foreground/10 bg-transparent text-muted-foreground/60";
  return (
    <div
      className={cn(
        "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border font-mono leading-none tabular-nums transition-colors",
        ring,
      )}
    >
      <span className="text-base font-semibold tracking-tight">{score || "—"}</span>
      <span className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-muted-foreground/70">
        score
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { tone: "neutral" | "active" | "muted" | "warning"; label: string }> = {
    new: { tone: "active", label: "Fresh" },
    queued: { tone: "neutral", label: "Queued" },
    applied: { tone: "neutral", label: "Applied" },
    interview: { tone: "active", label: "Interview" },
    rejected: { tone: "muted", label: "Rejected" },
    no_response: { tone: "warning", label: "Silent" },
    skipped: { tone: "muted", label: "Skipped" },
  };
  const m = map[status];
  if (!m) return null;
  return <Badge tone={m.tone}>{m.label}</Badge>;
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
