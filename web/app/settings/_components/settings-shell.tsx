"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  FileText,
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeProfile } from "@/lib/ai/provider";
import { AiProviderSection } from "./ai-provider-section";
import { ResumeSection } from "./resume-section";
import { ApiKeySection } from "./api-key-section";
import { GmailSection } from "./gmail-section";

type Provider = "groq" | "gemini" | "claude" | "rules";

export type SettingsUser = {
  email: string;
  name: string | null;
  image: string | null;
  aiProvider: Provider;
  hasAiApiKey: boolean;
  gmailConnected: boolean;
  apiKey: string;
  hasResume: boolean;
  resumeParsed: ResumeProfile | null;
};

type SectionId = "ai" | "resume" | "extension" | "gmail";

type SectionMeta = {
  id: SectionId;
  title: string;
  caption: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const SECTIONS: SectionMeta[] = [
  { id: "ai", title: "AI provider", caption: "Resume parsing & job scoring", icon: Sparkles },
  { id: "resume", title: "Resume", caption: "What we match jobs against", icon: FileText },
  { id: "extension", title: "Extension key", caption: "Chrome ext authentication", icon: KeyRound },
  { id: "gmail", title: "Gmail", caption: "Inbox sync for replies", icon: Mail },
];

export function SettingsShell({ user }: { user: SettingsUser }) {
  const params = useSearchParams();
  const initial: SectionId = params.get("gmail") ? "gmail" : "ai";
  const [active, setActive] = React.useState<SectionId>(initial);
  const [state, setState] = React.useState(user);

  const status: Record<SectionId, { label: string; ok: boolean }> = {
    ai: state.aiProvider === "rules"
      ? { label: "Rules (free)", ok: true }
      : { label: state.hasAiApiKey ? `${labelFor(state.aiProvider)} · key set` : `${labelFor(state.aiProvider)} · no key`, ok: state.hasAiApiKey },
    resume: state.hasResume
      ? { label: state.resumeParsed?.skills?.length ? `${state.resumeParsed.skills.length} skills parsed` : "Uploaded", ok: true }
      : { label: "Not uploaded", ok: false },
    extension: { label: "Active", ok: true },
    gmail: state.gmailConnected
      ? { label: "Connected", ok: true }
      : { label: "Not connected", ok: false },
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground antialiased">
      <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8 md:py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr] lg:gap-16">
          {/* Left rail */}
          <aside className="lg:sticky lg:top-12 lg:self-start">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Back to dashboard
            </Link>

            <h1 className="mt-6 text-3xl font-medium tracking-tight md:text-4xl">
              Settings
            </h1>
            <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
              Configure how the tracker scores jobs and authenticates your tools.
            </p>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Signed in as <span className="font-medium text-foreground">{state.email}</span>
            </div>

            <nav className="mt-10 flex flex-col gap-1">
              {SECTIONS.map((s, i) => {
                const isActive = active === s.id;
                const st = status[s.id];
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "group/nav relative flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                      "hover:bg-foreground/[0.04]",
                      "active:translate-y-px",
                      isActive && "bg-foreground/[0.05]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                        isActive
                          ? "border-foreground/20 bg-background text-foreground"
                          : "border-foreground/10 bg-background/50 text-muted-foreground group-hover/nav:text-foreground",
                      )}
                    >
                      <s.icon className="size-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-none text-foreground">{s.title}</span>
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {st.ok ? (
                          <CheckCircle2 className="size-3 text-emerald-600" strokeWidth={2} />
                        ) : (
                          <CircleDashed className="size-3 text-muted-foreground/60" strokeWidth={2} />
                        )}
                        <span className="truncate">{st.label}</span>
                      </span>
                    </span>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-foreground" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right content */}
          <main className="min-w-0">
            <div className="rounded-2xl border border-foreground/10 bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_40px_-25px_rgba(0,0,0,0.06)]">
              {active === "ai" && (
                <AiProviderSection
                  provider={state.aiProvider}
                  hasKey={state.hasAiApiKey}
                  onSaved={(p, hasKey) =>
                    setState((s) => ({ ...s, aiProvider: p, hasAiApiKey: hasKey }))
                  }
                />
              )}
              {active === "resume" && (
                <ResumeSection
                  resumeParsed={state.resumeParsed}
                  hasResume={state.hasResume}
                  onParsed={(parsed) =>
                    setState((s) => ({ ...s, resumeParsed: parsed, hasResume: true }))
                  }
                />
              )}
              {active === "extension" && (
                <ApiKeySection
                  apiKey={state.apiKey}
                  onRegenerated={(key) => setState((s) => ({ ...s, apiKey: key }))}
                />
              )}
              {active === "gmail" && (
                <GmailSection
                  connected={state.gmailConnected}
                  onDisconnected={() =>
                    setState((s) => ({ ...s, gmailConnected: false }))
                  }
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function labelFor(p: Provider): string {
  return p === "groq" ? "Groq" : p === "gemini" ? "Gemini" : p === "claude" ? "Claude" : "Rules";
}
