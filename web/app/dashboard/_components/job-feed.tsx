"use client";

import * as React from "react";
import { Search, Loader2, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { JobRow } from "./job-row";
import { FilterBar, EMPTY_FILTERS, type FilterState } from "./filter-bar";
import { SavedSearchesStrip, type SavedSearch } from "./saved-searches-strip";
import { JobDetailPanel } from "./job-detail-panel";

export type FeedItem = {
  id: string;
  score: number | null;
  scoreReason: string | null;
  status: string;
  appliedAt: string | null;
  emailNote: string | null;
  autoSkippedReason: string | null;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
    source: string;
    postedAt: string;
    foundAt: string;
    snapshotUrl: string | null;
    level: string | null;
    workMode: string | null;
    locationCity: string | null;
    locationCountry: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    minYoE: number | null;
    stackTags: string[];
  };
};

type Sort = "score" | "fresh";

type Facets = {
  level?: Record<string, number>;
  workMode?: Record<string, number>;
  source?: Record<string, number>;
  stackTags?: Record<string, number>;
};

const KNOWN_STACK = [
  "react", "nextjs", "typescript", "javascript", "node", "go", "rust",
  "python", "java", "kotlin", "swift", "ruby", "rails", "django",
  "postgresql", "mysql", "redis", "kafka", "kubernetes", "docker",
  "aws", "gcp", "terraform", "graphql", "grpc",
];

function mergeFilters(base: FilterState, raw: Record<string, unknown>): FilterState {
  const arr = (k: string): string[] =>
    Array.isArray(raw[k]) ? (raw[k] as string[]) : [];
  const num = (k: string): number | null =>
    typeof raw[k] === "number" ? (raw[k] as number) : null;
  let postedWithinHours: number | null = base.postedWithinHours;
  if (typeof raw.postedAfter === "string") {
    const hrs = Math.round(
      (Date.now() - new Date(raw.postedAfter as string).getTime()) / 36e5,
    );
    postedWithinHours = [24, 72, 168, 720].includes(hrs) ? hrs : null;
  }
  return {
    level: arr("level"),
    workMode: arr("workMode"),
    source: arr("source"),
    stackTags: arr("stackTags"),
    salaryMin: num("salaryMin"),
    maxYoE: num("maxYoE"),
    postedWithinHours,
  };
}

export function JobFeed({
  statuses,
  initialItems,
  onCountsChange,
}: {
  statuses: string[];
  initialItems: FeedItem[];
  onCountsChange: (counts: Record<string, number>) => void;
}) {
  const [items, setItems] = React.useState<FeedItem[]>(initialItems);
  const [loading, setLoading] = React.useState(initialItems.length === 0);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("score");
  const [minScore, setMinScore] = React.useState(0);
  const [total, setTotal] = React.useState<number | null>(null);
  const skipInitialFetch = React.useRef(initialItems.length > 0);

  // New filter state
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);
  const [savedSearches, setSavedSearches] = React.useState<SavedSearch[]>([]);
  const [activeSavedSearchId, setActiveSavedSearchId] = React.useState<string | null>(null);
  const [openJobId, setOpenJobId] = React.useState<string | null>(null);
  const [facets, setFacets] = React.useState<Facets | undefined>(undefined);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  // Load saved searches on mount
  React.useEffect(() => {
    fetch("/api/saved-searches")
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d: { items: SavedSearch[] }) => setSavedSearches(d.items ?? []))
      .catch(() => {/* ignore */});
  }, []);

  const fetchItems = React.useCallback(
    async (signal: AbortSignal) => {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: statuses.join(","),
          sort,
          limit: "60",
        });
        if (debouncedQ) params.set("q", debouncedQ);
        if (minScore > 0) params.set("minScore", String(minScore));

        // Rich filters
        if (filters.level.length) params.set("level", filters.level.join(","));
        if (filters.workMode.length) params.set("workMode", filters.workMode.join(","));
        if (filters.source.length) params.set("source", filters.source.join(","));
        if (filters.stackTags.length) params.set("stackTags", filters.stackTags.join(","));
        if (filters.salaryMin !== null) params.set("salaryMin", String(filters.salaryMin));
        if (filters.maxYoE !== null) params.set("maxYoE", String(filters.maxYoE));
        if (filters.postedWithinHours !== null) {
          params.set(
            "postedAfter",
            new Date(Date.now() - filters.postedWithinHours * 36e5).toISOString(),
          );
        }

        const res = await fetch(`/api/jobs?${params}`, { signal, cache: "no-store" });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = (await res.json()) as {
          items: FeedItem[];
          total: number;
          countsByStatus: Record<string, number>;
          facets?: Facets;
        };
        setItems(data.items);
        setTotal(data.total);
        onCountsChange(data.countsByStatus);
        if (data.facets) setFacets(data.facets);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    },
    [statuses, debouncedQ, sort, minScore, filters, onCountsChange],
  );

  React.useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const ctrl = new AbortController();
    fetchItems(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchItems]);

  function patchItem(id: string, patch: Partial<FeedItem>, removeFromList: boolean) {
    setItems((prev) => {
      if (removeFromList) return prev.filter((it) => it.id !== id);
      return prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
    });
  }

  // Saved search handlers
  async function handleSaveCurrent(name: string) {
    const filtersPayload: Record<string, unknown> = {};
    if (filters.level.length) filtersPayload.level = filters.level;
    if (filters.workMode.length) filtersPayload.workMode = filters.workMode;
    if (filters.source.length) filtersPayload.source = filters.source;
    if (filters.stackTags.length) filtersPayload.stackTags = filters.stackTags;
    if (filters.salaryMin !== null) filtersPayload.salaryMin = filters.salaryMin;
    if (filters.maxYoE !== null) filtersPayload.maxYoE = filters.maxYoE;
    if (filters.postedWithinHours !== null) {
      filtersPayload.postedAfter = new Date(
        Date.now() - filters.postedWithinHours * 36e5,
      ).toISOString();
    }
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filters: filtersPayload, sortIndex: savedSearches.length }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as SavedSearch;
    setSavedSearches((prev) => [...prev, data]);
  }

  async function handleDeleteSaved(id: string) {
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSelectSaved(id: string | null) {
    setActiveSavedSearchId(id);
    if (id === null) {
      setFilters(EMPTY_FILTERS);
      return;
    }
    const found = savedSearches.find((s) => s.id === id);
    if (found) {
      setFilters(mergeFilters(EMPTY_FILTERS, found.filters));
    }
  }

  // Panel action handler
  async function handlePanelAction(action: "queued" | "applied" | "skipped") {
    if (!openJobId) return;
    const res = await fetch(`/api/jobs/${openJobId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { status: string; appliedAt: string | null };
    const item = items.find((it) => it.id === openJobId);
    if (item) {
      const removeFromList =
        ["new", "queued"].includes(item.status) && !["new", "queued"].includes(action);
      patchItem(openJobId, { status: data.status, appliedAt: data.appliedAt }, removeFromList);
    }
  }

  // Hide company handler
  async function handleHideCompany(company: string) {
    await fetch(`/api/users/me/hidden-companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company }),
    });
    // Remove all items from this company from the list
    setItems((prev) => prev.filter((it) => it.job.company !== company));
  }

  return (
    <section className="flex flex-col gap-5">
      {/* Saved searches strip */}
      <SavedSearchesStrip
        items={savedSearches}
        activeId={activeSavedSearchId}
        onSelect={handleSelectSaved}
        onSaveCurrent={handleSaveCurrent}
        onDelete={handleDeleteSaved}
      />

      {/* Search + sort bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-65 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or company"
            className="h-10 pl-9.5"
          />
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-md surface-sunken p-1">
          <SegmentChip active={sort === "score"} onClick={() => setSort("score")}>
            Score
          </SegmentChip>
          <SegmentChip active={sort === "fresh"} onClick={() => setSort("fresh")}>
            Fresh
          </SegmentChip>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-md surface-sunken p-1">
          {[0, 60, 80].map((n) => (
            <SegmentChip
              key={n}
              active={minScore === n}
              mono
              onClick={() => setMinScore(n)}
            >
              {n === 0 ? "All" : `${n}+`}
            </SegmentChip>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          {loading && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
          <span>
            {total === null ? "—" : total} {total === 1 ? "result" : "results"}
          </span>
        </div>
      </div>

      {/* Rich filter bar */}
      <FilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setActiveSavedSearchId(null);
        }}
        facets={facets}
        knownStackTags={KNOWN_STACK}
      />

      {/* Feed */}
      {error ? (
        <ErrorState message={error} />
      ) : loading && items.length === 0 ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <JobRow item={item} onChange={patchItem} onOpenDetail={setOpenJobId} />
            </li>
          ))}
        </ul>
      )}

      {/* Detail panel */}
      <JobDetailPanel
        jobId={openJobId}
        onClose={() => setOpenJobId(null)}
        onAction={handlePanelAction}
        onHideCompany={handleHideCompany}
      />
    </section>
  );
}

function SegmentChip({
  active,
  onClick,
  mono,
  children,
}: {
  active: boolean;
  onClick: () => void;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-sm px-3 py-1 text-[12px] font-medium transition-colors duration-150",
        mono && "font-mono text-[11px] tabular-nums",
        active
          ? "bg-card text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/10%),0_2px_8px_-3px_oklch(0_0_0/15%)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SkeletonList() {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-md surface px-4 py-4"
        >
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-foreground/4" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-foreground/5" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-foreground/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-foreground/12 bg-foreground/[0.012] px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-md surface-sunken">
        <Inbox className="size-5 text-muted-foreground" strokeWidth={1.5} />
      </span>
      <div>
        <div className="font-display italic text-lg leading-snug">Nothing here yet</div>
        <p className="mt-1.5 max-w-[40ch] text-[13px] leading-relaxed text-muted-foreground">
          The scraper runs every two hours. Fresh roles will land here once your
          resume and AI provider are configured.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-warm/25 bg-rose-warm/8 px-4 py-3 text-sm text-rose-warm">
      {message}
    </div>
  );
}
