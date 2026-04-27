"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, Inbox, Reply, CalendarClock, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "./section-header";

const PERKS = [
  { icon: Inbox, label: "Auto-detects rejection emails and updates job status." },
  { icon: Reply, label: "Flags interview invitations so they surface immediately." },
  { icon: CalendarClock, label: "Marks jobs as 'no response' after 7 days of silence." },
];

export function GmailSection({
  connected,
  onDisconnected,
}: {
  connected: boolean;
  onDisconnected: () => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const flash = params.get("gmail");
  const reason = params.get("reason");

  React.useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail");
      url.searchParams.delete("reason");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }, 4000);
    return () => clearTimeout(t);
  }, [flash, router]);

  function connect() {
    window.location.href = "/api/gmail/connect";
  }

  async function disconnect() {
    setError(null);
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      onDisconnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="04 — Inbox sync"
        title="Gmail"
        description="Read-only access to your inbox to pick up rejections, interview requests, and silence. Tokens are scoped to gmail.readonly and stored encrypted."
        action={
          <Badge tone={connected ? "active" : "muted"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        }
      />

      <div className="px-7 py-7 md:px-9">
        {flash === "connected" && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-sage/25 bg-sage/8 px-3.5 py-3 text-sm text-sage">
            <Check className="size-4" strokeWidth={2} />
            Gmail connected — first sync runs within 2 hours.
          </div>
        )}
        {flash === "error" && (
          <div className="mb-6 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" strokeWidth={1.75} />
            <span>Couldn't connect Gmail{reason ? ` (${reason})` : ""}. Try again.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          {/* Perks list */}
          <ul className="divide-y divider-warm border-y divider-warm">
            {PERKS.map((p) => (
              <li key={p.label} className="flex items-start gap-3.5 py-4">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl surface-sunken">
                  <p.icon className="size-3.5 text-foreground/75" strokeWidth={1.75} />
                </span>
                <p className="text-[13.5px] leading-relaxed text-foreground/85">
                  {p.label}
                </p>
              </li>
            ))}
          </ul>

          {/* Connect card */}
          <aside className="flex flex-col gap-4 rounded-2xl border border-dashed border-foreground/15 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl surface">
              <Mail className="size-4 text-foreground/75" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-display text-[15px] font-medium text-foreground">
                {connected ? "Sync active" : "Not connected"}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {connected
                  ? "Inbox polled every 2 hours via GitHub Actions."
                  : "Click connect to grant gmail.readonly — only headers and snippets are scanned."}
              </p>
            </div>
            {connected ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={disconnect}
                disabled={disconnecting}
                className="w-full"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                    Disconnecting
                  </>
                ) : (
                  "Disconnect Gmail"
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={connect}
                className="w-full"
              >
                Connect Gmail
              </Button>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
