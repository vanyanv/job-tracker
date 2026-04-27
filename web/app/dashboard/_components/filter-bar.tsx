"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterState {
  level: string[];
  workMode: string[];
  source: string[];
  postedWithinHours: number | null;
  salaryMin: number | null;
  maxYoE: number | null;
  stackTags: string[];
}

export const EMPTY_FILTERS: FilterState = {
  level: [],
  workMode: [],
  source: [],
  postedWithinHours: null,
  salaryMin: null,
  maxYoE: null,
  stackTags: [],
};

const LEVEL_OPTIONS = ["junior", "mid", "senior", "staff", "principal"] as const;
const WORK_MODE_OPTIONS = ["remote", "hybrid", "onsite"] as const;
const SOURCE_OPTIONS = ["ashby", "greenhouse", "lever"] as const;
const SOURCE_LABELS: Record<string, string> = {
  ashby: "Ashby",
  greenhouse: "Greenhouse",
  lever: "Lever",
};
const POSTED_WINDOWS = [
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
] as const;

interface Props {
  value: FilterState;
  onChange: (next: FilterState) => void;
  facets?: {
    level?: Record<string, number>;
    workMode?: Record<string, number>;
    source?: Record<string, number>;
    stackTags?: Record<string, number>;
  };
  knownStackTags: string[];
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function hasFilters(f: FilterState): boolean {
  return (
    f.level.length > 0 ||
    f.workMode.length > 0 ||
    f.source.length > 0 ||
    f.postedWithinHours !== null ||
    f.salaryMin !== null ||
    f.maxYoE !== null ||
    f.stackTags.length > 0
  );
}

export function FilterBar({ value, onChange, facets, knownStackTags }: Props) {
  const anyActive = hasFilters(value);

  function setLevel(l: string) {
    onChange({ ...value, level: toggle(value.level, l) });
  }
  function setWorkMode(m: string) {
    onChange({ ...value, workMode: toggle(value.workMode, m) });
  }
  function setSource(s: string) {
    onChange({ ...value, source: toggle(value.source, s) });
  }
  function setPosted(hours: number | null) {
    onChange({
      ...value,
      postedWithinHours: value.postedWithinHours === hours ? null : hours,
    });
  }
  function setStackTag(tag: string) {
    onChange({ ...value, stackTags: toggle(value.stackTags, tag) });
  }

  // Combine known tags from facets + knownStackTags prop
  const allStackTags = React.useMemo(() => {
    const fromFacets = facets?.stackTags ? Object.keys(facets.stackTags) : [];
    const combined = Array.from(new Set([...knownStackTags, ...fromFacets]));
    // Sort: active first, then by facet count descending, then alpha
    return combined.sort((a, b) => {
      const aActive = value.stackTags.includes(a);
      const bActive = value.stackTags.includes(b);
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aCount = facets?.stackTags?.[a] ?? 0;
      const bCount = facets?.stackTags?.[b] ?? 0;
      return bCount - aCount || a.localeCompare(b);
    });
  }, [knownStackTags, facets, value.stackTags]);

  return (
    <div className="flex flex-wrap gap-4 rounded-md surface-sunken px-4 py-3">
      {/* Level */}
      <FilterGroup label="Level">
        <div className="inline-flex items-center gap-0.5 rounded-sm surface p-0.5">
          {LEVEL_OPTIONS.map((l) => {
            const count = facets?.level?.[l];
            return (
              <ChipButton
                key={l}
                active={value.level.includes(l)}
                onClick={() => setLevel(l)}
                count={count}
              >
                {l}
              </ChipButton>
            );
          })}
        </div>
      </FilterGroup>

      {/* Work mode */}
      <FilterGroup label="Mode">
        <div className="inline-flex items-center gap-0.5 rounded-sm surface p-0.5">
          {WORK_MODE_OPTIONS.map((m) => {
            const count = facets?.workMode?.[m];
            return (
              <ChipButton
                key={m}
                active={value.workMode.includes(m)}
                onClick={() => setWorkMode(m)}
                count={count}
              >
                {m}
              </ChipButton>
            );
          })}
        </div>
      </FilterGroup>

      {/* Source */}
      <FilterGroup label="Source">
        <div className="inline-flex items-center gap-0.5 rounded-sm surface p-0.5">
          {SOURCE_OPTIONS.map((s) => {
            const count = facets?.source?.[s];
            return (
              <ChipButton
                key={s}
                active={value.source.includes(s)}
                onClick={() => setSource(s)}
                count={count}
              >
                {SOURCE_LABELS[s] ?? s}
              </ChipButton>
            );
          })}
        </div>
      </FilterGroup>

      {/* Posted within */}
      <FilterGroup label="Posted">
        <div className="inline-flex items-center gap-0.5 rounded-sm surface p-0.5">
          {POSTED_WINDOWS.map(({ label, hours }) => (
            <ChipButton
              key={hours}
              active={value.postedWithinHours === hours}
              onClick={() => setPosted(hours)}
            >
              {label}
            </ChipButton>
          ))}
        </div>
      </FilterGroup>

      {/* Salary min */}
      <FilterGroup label="Min salary ($k)">
        <Input
          type="number"
          min={0}
          step={10}
          value={value.salaryMin ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange({ ...value, salaryMin: n !== null && !Number.isNaN(n) ? n * 1000 : null });
          }}
          placeholder="e.g. 120"
          className="h-7 w-24 text-[12px] font-mono"
        />
      </FilterGroup>

      {/* Max YoE */}
      <FilterGroup label="Max YoE">
        <Input
          type="number"
          min={0}
          max={20}
          step={1}
          value={value.maxYoE ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange({ ...value, maxYoE: n !== null && !Number.isNaN(n) ? n : null });
          }}
          placeholder="e.g. 3"
          className="h-7 w-20 text-[12px] font-mono"
        />
      </FilterGroup>

      {/* Stack tags */}
      {allStackTags.length > 0 && (
        <FilterGroup label="Stack">
          <div className="flex flex-wrap gap-1">
            {allStackTags.slice(0, 18).map((tag) => {
              const count = facets?.stackTags?.[tag];
              return (
                <ChipButton
                  key={tag}
                  active={value.stackTags.includes(tag)}
                  onClick={() => setStackTag(tag)}
                  count={count}
                >
                  {tag}
                </ChipButton>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {/* Clear all */}
      {anyActive && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="ml-auto self-end inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <X className="size-3" strokeWidth={2} />
          Clear
        </button>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors duration-150",
        active
          ? "bg-card text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/10%),0_2px_8px_-3px_oklch(0_0_0/15%)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "ml-1 tabular-nums",
            active ? "text-foreground/60" : "text-muted-foreground/50",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
