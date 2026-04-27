"use client";

import * as React from "react";
import {
  X,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ListPlus,
  Loader2,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ScoreRing } from "@/app/_components/score-ring";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JobDetailData {
  job: {
    id: string;
    title: string;
    company: string;
    url: string;
    location: string;
    locationCity?: string | null;
    locationCountry?: string | null;
    description: string | null;
    snapshotUrl: string | null;
    postedAt: string;
    source: string;
    level?: string | null;
    workMode?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    minYoE?: number | null;
    stackTags?: string[];
  } | null;
  userJob: {
    id: string;
    status: string;
    score: number | null;
    scoreReason: string | null;
    emailNote: string | null;
    appliedAt: string | null;
  } | null;
}

interface Props {
  jobId: string | null;
  onClose: () => void;
  onAction: (action: "queued" | "applied" | "skipped") => Promise<void>;
  onHideCompany: (company: string) => Promise<void>;
}

const SOURCE_LABEL: Record<string, string> = {
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
};

function fmtSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)}–${k(max)}`;
  if (min) return `${k(min)}+`;
  if (max) return `up to ${k(max)}`;
  return null;
}

export function JobDetailPanel({ jobId, onClose, onAction, onHideCompany }: Props) {
  const [data, setData] = React.useState<JobDetailData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [hidingCompany, setHidingCompany] = React.useState(false);
  const [snapshotOpen, setSnapshotOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Load job data when jobId changes
  React.useEffect(() => {
    if (!jobId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSnapshotOpen(false);
    fetch(`/api/jobs/${jobId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json() as Promise<JobDetailData>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Esc key closes
  React.useEffect(() => {
    if (!jobId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [jobId, onClose]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (jobId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [jobId]);

  async function handleAction(action: "queued" | "applied" | "skipped") {
    setPending(action);
    try {
      await onAction(action);
      onClose();
    } finally {
      setPending(null);
    }
  }

  async function handleHideCompany() {
    if (!data?.job?.company) return;
    setHidingCompany(true);
    try {
      await onHideCompany(data.job.company);
      onClose();
    } finally {
      setHidingCompany(false);
    }
  }

  if (!jobId) return null;

  const job = data?.job;
  const userJob = data?.userJob;
  const salary = job ? fmtSalary(job.salaryMin, job.salaryMax) : null;
  const displayLocation =
    job?.locationCity && job?.locationCountry
      ? `${job.locationCity}, ${job.locationCountry}`
      : job?.location || "—";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={job?.title ?? "Job details"}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col surface shadow-[−4px_0_32px_-8px_oklch(0_0_0/20%)]",
          "translate-x-0 transition-transform duration-300 ease-out",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-foreground/8 px-6 py-5">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-2">
                <div className="h-5 w-3/4 animate-pulse rounded bg-foreground/5" />
                <div className="h-3.5 w-1/2 animate-pulse rounded bg-foreground/3" />
              </div>
            ) : (
              <>
                <h2 className="font-display text-[18px] font-medium leading-snug tracking-tight text-foreground">
                  {job?.title ?? "—"}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
                  <span>{job?.company}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{displayLocation}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!loading && userJob && (
              <ScoreRing score={userJob.score ?? 0} size="md" />
            )}
            <button
              onClick={onClose}
              className="press-feedback inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="m-6 rounded-md border border-rose-warm/25 bg-rose-warm/8 px-4 py-3 text-sm text-rose-warm">
              {error}
            </div>
          ) : loading ? (
            <PanelSkeleton />
          ) : job ? (
            <div className="flex flex-col gap-0 divide-y divide-foreground/6">
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3 px-6 py-5">
                {job.level && job.level !== "unknown" && (
                  <MetaCell label="Level">
                    <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-foreground">
                      {job.level}
                    </span>
                  </MetaCell>
                )}
                {job.workMode && job.workMode !== "unknown" && (
                  <MetaCell label="Mode">
                    <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-foreground">
                      {job.workMode}
                    </span>
                  </MetaCell>
                )}
                {salary && (
                  <MetaCell label="Salary">
                    <span className="font-mono text-[11px] tabular-nums text-apricot">
                      {salary}
                    </span>
                  </MetaCell>
                )}
                {job.minYoE !== null && job.minYoE !== undefined && (
                  <MetaCell label="Min YoE">
                    <span className="font-mono text-[11px] tabular-nums text-foreground">
                      {job.minYoE}+
                    </span>
                  </MetaCell>
                )}
                <MetaCell label="Source">
                  <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    {SOURCE_LABEL[job.source] ?? job.source}
                  </span>
                </MetaCell>
                <MetaCell label="Posted">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {relTime(job.postedAt)}
                  </span>
                </MetaCell>
              </div>

              {/* Stack tags */}
              {job.stackTags && job.stackTags.length > 0 && (
                <div className="px-6 py-4">
                  <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/70">
                    Stack
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.stackTags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Score reason */}
              {userJob?.scoreReason && (
                <div className="px-6 py-4">
                  <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/70">
                    Why this score
                  </div>
                  <p className="rounded-md surface-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground/80">
                    {userJob.scoreReason}
                  </p>
                </div>
              )}

              {/* Email note / notes (read-only) */}
              {userJob?.emailNote && (
                <div className="px-6 py-4">
                  <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/70">
                    Note
                  </div>
                  <p className="rounded-md surface-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {userJob.emailNote}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/50">
                    notes editing coming soon
                  </p>
                </div>
              )}

              {/* Description */}
              {job.description && (
                <div className="px-6 py-4">
                  <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/70">
                    Description
                  </div>
                  <div className="max-h-[280px] overflow-y-auto rounded-md surface-sunken px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
                    {job.description}
                  </div>
                </div>
              )}

              {/* PDF snapshot (collapsible, lazy) */}
              {job.snapshotUrl && (
                <div className="px-6 py-4">
                  <button
                    onClick={() => setSnapshotOpen((v) => !v)}
                    className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/70 transition-colors duration-150 hover:text-foreground"
                  >
                    {snapshotOpen ? (
                      <ChevronDown className="size-3" strokeWidth={2} />
                    ) : (
                      <ChevronRight className="size-3" strokeWidth={2} />
                    )}
                    PDF Snapshot
                  </button>
                  {snapshotOpen && (
                    <div className="mt-3 overflow-hidden rounded-md border border-foreground/8">
                      <iframe
                        src={job.snapshotUrl}
                        title="Job snapshot"
                        className="h-[400px] w-full"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Action row */}
        {!loading && job && userJob && (
          <div className="flex flex-wrap items-center gap-2 border-t border-foreground/8 px-6 py-4">
            {userJob.status === "new" && (
              <PanelAction
                onClick={() => handleAction("queued")}
                pending={pending === "queued"}
                icon={ListPlus}
                label="Queue"
              />
            )}
            {(userJob.status === "new" || userJob.status === "queued") && (
              <PanelAction
                onClick={() => handleAction("applied")}
                pending={pending === "applied"}
                icon={CheckCircle2}
                label="Applied"
                tone="apricot"
              />
            )}
            {(userJob.status === "new" || userJob.status === "queued") && (
              <PanelAction
                onClick={() => handleAction("skipped")}
                pending={pending === "skipped"}
                icon={XCircle}
                label="Skip"
                ghost
              />
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleHideCompany}
                disabled={hidingCompany}
                title={`Hide all jobs from ${job.company}`}
                className="press-feedback inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {hidingCompany ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <EyeOff className="size-3.5" strokeWidth={1.75} />
                )}
                <span className="hidden sm:inline">Hide {job.company}</span>
              </button>
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="press-feedback inline-flex h-8 items-center gap-1.5 rounded-md surface-sunken px-2.5 text-[12px] text-foreground transition-colors duration-150 hover:brightness-105"
              >
                <ExternalLink className="size-3.5" strokeWidth={1.75} />
                <span>Open ↗</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground/60">
        {label}
      </span>
      {children}
    </div>
  );
}

function PanelAction({
  onClick,
  pending,
  icon: Icon,
  label,
  tone,
  ghost,
}: {
  onClick: () => void;
  pending: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
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
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="size-3.5" strokeWidth={1.75} />
      )}
      {label}
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-12 animate-pulse rounded bg-foreground/4" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-foreground/5" />
          </div>
        ))}
      </div>
      <div className="h-24 animate-pulse rounded bg-foreground/3" />
      <div className="h-40 animate-pulse rounded bg-foreground/3" />
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
