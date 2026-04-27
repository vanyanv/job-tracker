"use client";

import * as React from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SavedSearch {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  sortIndex: number;
}

interface Props {
  items: SavedSearch[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onSaveCurrent: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SavedSearchesStrip({
  items,
  activeId,
  onSelect,
  onSaveCurrent,
  onDelete,
}: Props) {
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [showInput, setShowInput] = React.useState(false);
  const [name, setName] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSaveCurrent(trimmed);
      setName("");
      setShowInput(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeleting(id);
    try {
      await onDelete(id);
      if (activeId === id) onSelect(null);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  function cancelSave() {
    setName("");
    setShowInput(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* "All" tab */}
      <StripTab
        active={activeId === null}
        onClick={() => {
          onSelect(null);
          setConfirmDelete(null);
        }}
      >
        All
      </StripTab>

      {/* Saved search tabs */}
      {items.map((item) => (
        <div key={item.id} className="group/ss relative flex items-center">
          <StripTab
            active={activeId === item.id}
            onClick={() => {
              onSelect(item.id);
              setConfirmDelete(null);
            }}
          >
            {item.name}
          </StripTab>
          {/* Delete button — appears on hover */}
          <button
            onClick={() => handleDelete(item.id)}
            disabled={deleting === item.id}
            title={confirmDelete === item.id ? "Click again to confirm" : "Delete saved search"}
            className={cn(
              "absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full transition-all duration-150",
              "opacity-0 group-hover/ss:opacity-100",
              confirmDelete === item.id
                ? "bg-rose-warm text-white"
                : "bg-foreground/10 text-muted-foreground hover:bg-rose-warm/20 hover:text-rose-warm",
            )}
          >
            {deleting === item.id ? (
              <Loader2 className="size-2.5 animate-spin" strokeWidth={2} />
            ) : (
              <Trash2 className="size-2.5" strokeWidth={2} />
            )}
          </button>
        </div>
      ))}

      {/* Save current / inline input */}
      {showInput ? (
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") cancelSave();
            }}
            placeholder="Search name…"
            className="h-7 w-36 text-[12px]"
          />
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-sm px-2.5 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
              "bg-apricot/20 text-foreground hover:bg-apricot/35",
            )}
          >
            {saving ? <Loader2 className="size-3 animate-spin" strokeWidth={2} /> : null}
            Save
          </button>
          <button
            onClick={cancelSave}
            className="inline-flex h-7 items-center px-2 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground/70 transition-colors duration-150 hover:text-foreground"
        >
          <Plus className="size-3" strokeWidth={2} />
          Save search
        </button>
      )}
    </div>
  );
}

function StripTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors duration-150",
        active
          ? "bg-card text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/10%),0_2px_8px_-3px_oklch(0_0_0/15%)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
