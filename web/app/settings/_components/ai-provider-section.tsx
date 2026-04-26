"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

type Provider = "groq" | "gemini" | "claude" | "rules";

type ProviderMeta = {
  id: Provider;
  name: string;
  tagline: string;
  ratePerDay: string;
  cost: string;
  needsKey: boolean;
  keyHint: string;
};

const PROVIDERS: ProviderMeta[] = [
  {
    id: "groq",
    name: "Groq",
    tagline: "Llama 3.3 70B — fast & free",
    ratePerDay: "14,400 / day",
    cost: "Free",
    needsKey: true,
    keyHint: "gsk_...",
  },
  {
    id: "gemini",
    name: "Gemini Flash",
    tagline: "Google's multi-modal model",
    ratePerDay: "1,500 / day",
    cost: "Free",
    needsKey: true,
    keyHint: "AIza...",
  },
  {
    id: "claude",
    name: "Claude",
    tagline: "Anthropic — highest quality",
    ratePerDay: "Pay per request",
    cost: "Paid",
    needsKey: true,
    keyHint: "sk-ant-...",
  },
  {
    id: "rules",
    name: "Rules",
    tagline: "Keyword matching, no API needed",
    ratePerDay: "Unlimited",
    cost: "Free",
    needsKey: false,
    keyHint: "",
  },
];

export function AiProviderSection({
  provider,
  hasKey,
  onSaved,
}: {
  provider: Provider;
  hasKey: boolean;
  onSaved: (provider: Provider, hasKey: boolean) => void;
}) {
  const [selected, setSelected] = React.useState<Provider>(provider);
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const meta = PROVIDERS.find((p) => p.id === selected)!;
  const dirty =
    selected !== provider ||
    (meta.needsKey && apiKey.trim().length > 0);

  React.useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2400);
    return () => clearTimeout(t);
  }, [savedAt]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const body: { aiProvider: Provider; aiApiKey?: string | null } = {
        aiProvider: selected,
      };
      if (meta.needsKey && apiKey.trim().length > 0) {
        body.aiApiKey = apiKey.trim();
      }
      if (selected === "rules") {
        body.aiApiKey = null;
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      const data = await res.json();
      onSaved(data.aiProvider as Provider, !!data.hasAiApiKey);
      setApiKey("");
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="01 — Inference"
        title="AI provider"
        description="Pick the engine that parses your resume and scores incoming job postings against your profile. You can switch any time — your key is encrypted at rest."
        action={
          <Badge tone={selected === "rules" ? "muted" : hasKey && selected === provider ? "active" : "warning"}>
            {selected === "rules"
              ? "Free tier"
              : hasKey && selected === provider
                ? "Connected"
                : "Needs key"}
          </Badge>
        }
      />

      <div className="px-7 py-7 md:px-9">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const isActive = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border bg-background p-4 text-left transition-all",
                  "active:translate-y-px",
                  isActive
                    ? "border-foreground/30 ring-1 ring-foreground/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                    : "border-foreground/10 hover:border-foreground/20",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium tracking-tight text-foreground">
                        {p.name}
                      </span>
                      {p.id === provider && (
                        <Badge tone="active" className="lowercase tracking-normal">
                          current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {p.tagline}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-all",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/25",
                    )}
                  >
                    {isActive && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                </div>
                <div className="flex items-center gap-3 border-t border-foreground/5 pt-3">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {p.ratePerDay}
                  </span>
                  <span className="size-1 rounded-full bg-foreground/15" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {p.cost}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {meta.needsKey && (
          <div className="mt-7 grid grid-cols-1 gap-2 border-t border-foreground/5 pt-7">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-key">
                {meta.name} API key
                {hasKey && selected === provider && (
                  <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    · stored
                  </span>
                )}
              </Label>
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-3.5" strokeWidth={1.75} /> : <Eye className="size-3.5" strokeWidth={1.75} />}
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={hasKey && selected === provider ? "•••••••• (leave blank to keep existing)" : meta.keyHint}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="mt-0.5 text-xs text-muted-foreground">
              Encrypted with AES-256-GCM before storage. Never logged.
            </p>
          </div>
        )}

        {selected === "rules" && (
          <div className="mt-7 flex items-start gap-3 rounded-xl border border-foreground/5 bg-muted/40 p-4">
            <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Rules mode does keyword overlap between job descriptions and your parsed resume.
              Faster than LLMs, but less nuanced. Useful as an always-free fallback.
            </p>
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse items-stretch gap-3 border-t border-foreground/5 pt-6 sm:flex-row sm:items-center sm:justify-end">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive sm:mr-auto">
              <AlertCircle className="size-4" strokeWidth={1.75} />
              {error}
            </div>
          )}
          {savedAt && !error && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 sm:mr-auto">
              <Check className="size-4" strokeWidth={2} />
              Saved
            </div>
          )}
          <Button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            size="lg"
            className="min-w-[140px]"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Saving
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
