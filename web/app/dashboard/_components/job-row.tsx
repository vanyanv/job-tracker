"use client";

import * as React from "react";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  ListPlus,
  Loader2,
  CornerDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/app/_components/score-ring";
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
  onOpenDetail,
}: {
  item: FeedItem;
  onChange: (id: string, patch: Partial<FeedItem>, removeFromList: boolean) => void;
  onOpenDetail?: (jobId: string) => void;
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
      const removeFromList =
        ["new", "queued"].includes(item.status) && !["new", "queued"].includes(next);
      onChange(item.id, { status: data.status, appliedAt: data.appliedAt }, removeFromList);
    } catch {
      // swallow
    } finally {
      setPending(null);
    }
  }

  const score = item.score ?? 0;

  return (
    <article
      className={cn(
        "group/row relative flex items-start gap-4 rounded-md surface px-4 py-4 md:px-5 md:py-4.5",
        "lift-on-hover",
      )}
    >
      <ScoreRing score={score} size="md" className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <button
            type="button"
            onClick={() => onOpenDetail?.(item.job.id)}
            className="font-display text-[16px] font-medium leading-snug tracking-tight text-foreground decoration-apricot/40 underline-offset-4 transition-colors duration-200 hover:text-foreground/80 hover:underline text-left"
          >
            {item.job.title}
          </button>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[13.5px] text-muted-foreground">
            {item.job.company}
          </span>
          <StatusChip status={item.status} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/85">
          <span>{item.job.location || "—"}</span>
          <Dot />
          <span>{relTime(item.job.postedAt)}</span>
          <Dot />
          <span>{SOURCE_LABEL[item.job.source] ?? item.job.source}</span>
          {item.scoreReason && (
            <>
              <Dot />
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-muted-foreground/70 underline-offset-4 transition-colors duration-150 hover:text-apricot hover:underline"
              >
                {expanded ? "Hide" : "Why this score"}
              </button>
            </>
          )}
        </div>

        {/* Chip row: level, workMode, salary, freshness, stack tags */}
        <JobChips item={item} />

        {expanded && item.scoreReason && (
          <p className="mt-3 flex items-start gap-2 rounded-md surface-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground/80">
            <CornerDownRight
              className="mt-0.5 size-3 shrink-0 text-muted-foreground/60"
              strokeWidth={1.75}
            />
            <span className="font-normal normal-case tracking-normal">
              {item.scoreReason}
            </span>
          </p>
        )}

        {item.emailNote && (
          <p className="mt-3 rounded-md surface-sunken px-3 py-2 text-xs text-muted-foreground">
            {item.emailNote}
          </p>
        )}
      </div>

      {/* Actions — visible on touch, hover-emphasized on desktop */}
      <div className="ml-auto flex shrink-0 items-center gap-1 opacity-90 transition-opacity duration-200 hover:opacity-100 md:opacity-70 md:group-hover/row:opacity-100">
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
            label="Applied"
            icon={CheckCircle2}
            tone="apricot"
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
          className="press-feedback inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-foreground/6 hover:text-foreground"
          title="Open posting"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
        </a>
      </div>
    </article>
  );
}

function Dot() {
  return (
    <span className="size-0.5 rounded-full bg-muted-foreground/30" aria-hidden />
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
  tone?: "apricot";
  ghost?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={label}
      className={cn(
        "press-feedback inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-[background-color,color,filter] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
        ghost
          ? "text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
          : tone === "apricot"
            ? "bg-apricot/25 text-foreground shadow-[inset_0_0_0_1px_oklch(0.886_0.052_53/45%)] hover:bg-apricot/40"
            : "surface-sunken text-foreground hover:brightness-105",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="size-3.5" strokeWidth={1.75} />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<
    string,
    { tone: "neutral" | "active" | "muted" | "warning" | "success" | "rose"; label: string }
  > = {
    new: { tone: "active", label: "Fresh" },
    queued: { tone: "neutral", label: "Queued" },
    applied: { tone: "success", label: "Applied" },
    interview: { tone: "warning", label: "Interview" },
    rejected: { tone: "rose", label: "Rejected" },
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

function FreshnessDot({ postedAt }: { postedAt: string }) {
  const ageHrs = (Date.now() - new Date(postedAt).getTime()) / 36e5;
  const cls =
    ageHrs <= 6
      ? "bg-sage"
      : ageHrs <= 24
        ? "bg-apricot"
        : "bg-muted-foreground/40";
  return (
    <span
      className={cn("inline-block size-1.5 rounded-full shrink-0", cls)}
      aria-hidden
    />
  );
}

function JobChips({ item }: { item: FeedItem }) {
  const { level, workMode, salaryMin, salaryMax, stackTags, postedAt } = item.job;

  const salary =
    salaryMin || salaryMax
      ? salaryMin && salaryMax
        ? `$${Math.round(salaryMin / 1000)}k–$${Math.round(salaryMax / 1000)}k`
        : salaryMin
          ? `$${Math.round(salaryMin / 1000)}k+`
          : `up to $${Math.round((salaryMax ?? 0) / 1000)}k`
      : null;

  const hasChips =
    (level && level !== "unknown") ||
    (workMode && workMode !== "unknown") ||
    salary ||
    (stackTags && stackTags.length > 0);

  if (!hasChips) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <FreshnessDot postedAt={postedAt} />
      {level && level !== "unknown" && (
        <span className="rounded-sm bg-foreground/6 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
          {level}
        </span>
      )}
      {workMode && workMode !== "unknown" && (
        <span className="rounded-sm bg-foreground/6 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
          {workMode}
        </span>
      )}
      {salary && (
        <span className="rounded-sm bg-apricot/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-apricot shadow-[inset_0_0_0_1px_oklch(0.886_0.052_53/25%)]">
          {salary}
        </span>
      )}
      {stackTags?.slice(0, 4).map((tag) => (
        <span
          key={tag}
          className="rounded-sm bg-foreground/4 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
