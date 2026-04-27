"use client";

import * as React from "react";
import { Copy, Check, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

export function ApiKeySection({
  apiKey,
  onRegenerated,
}: {
  apiKey: string;
  onRegenerated: (key: string) => void;
}) {
  const [reveal, setReveal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  }

  async function regenerate() {
    setError(null);
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/api-key", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      const data = await res.json();
      onRegenerated(data.apiKey as string);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  const masked = apiKey.replace(/.(?=.{4})/g, "•");

  return (
    <div>
      <SectionHeader
        eyebrow="03 — Authentication"
        title="Extension key"
        description="Used by the Chrome extension to mark jobs as applied after you submit on an ATS confirmation page. Treat it like a password — anyone with this key can write to your account."
        action={<Badge tone="active">Active</Badge>}
      />

      <div className="px-7 py-7 md:px-9">
        {/* Key display */}
        <div className="rounded-2xl surface-sunken p-1.5">
          <div className="flex items-center gap-2">
            <code
              onClick={() => setReveal((r) => !r)}
              className={cn(
                "flex-1 min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-foreground/4 px-3.5 py-2.5 font-mono text-[13px] tabular-nums text-foreground transition-colors duration-150 hover:bg-foreground/6",
                !reveal && "tracking-wider",
              )}
              title={reveal ? "Click to hide" : "Click to reveal"}
            >
              {reveal ? apiKey : masked}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copy}
              className="font-mono"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" strokeWidth={1.75} />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Usage hint */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl surface-sunken p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Where to paste it
            </div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/80">
              Open the Job Tracker extension popup, paste the key into the auth field, and save.
              You'll see a green dot appear when authenticated.
            </p>
          </div>
          <div className="rounded-2xl surface-sunken p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Header used
            </div>
            <code className="mt-2 block font-mono text-[11px] text-foreground/80">
              X-Api-Key: <span className="text-muted-foreground">{reveal ? apiKey.slice(0, 12) + "…" : "••••••••••••"}</span>
            </code>
          </div>
        </div>

        {/* Regenerate */}
        <div className="mt-7 border-t divider-warm pt-7">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="font-display text-[15px] font-medium text-foreground">Rotate key</div>
              <p className="mt-1 max-w-[52ch] text-xs leading-relaxed text-muted-foreground">
                Generates a new key and revokes the old one immediately. You'll need to paste the
                new key into your Chrome extension before it works again.
              </p>
            </div>

            {!confirming ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setConfirming(true)}
              >
                <RefreshCw className="size-3.5" strokeWidth={1.75} />
                Regenerate
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setConfirming(false)}
                  disabled={regenerating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={regenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                      Rotating
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-3.5" strokeWidth={1.75} />
                      Confirm rotate
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-destructive">{error}</div>
        )}
      </div>
    </div>
  );
}
