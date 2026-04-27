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
import { Topbar } from "@/app/_components/topbar";
import { WarmGlow } from "@/app/_components/warm-glow";
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
    ai:
      state.aiProvider === "rules"
        ? { label: "Rules (free)", ok: true }
        : {
            label: state.hasAiApiKey
              ? `${labelFor(state.aiProvider)} · key set`
              : `${labelFor(state.aiProvider)} · no key`,
            ok: state.hasAiApiKey,
          },
    resume: state.hasResume
      ? {
          label: state.resumeParsed?.skills?.length
            ? `${state.resumeParsed.skills.length} skills parsed`
            : "Uploaded",
          ok: true,
        }
      : { label: "Not uploaded", ok: false },
    extension: { label: "Active", ok: true },
    gmail: state.gmailConnected
      ? { label: "Connected", ok: true }
      : { label: "Not connected", ok: false },
  };

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <Topbar user={user} active="settings" />

      <div className="relative mx-auto max-w-[1280px] px-4 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24">
        <WarmGlow position="top-right" size="lg" hue="apricot" className="opacity-70" />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Pipeline
            </Link>

            <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Configure
            </div>
            <h1 className="hearth-enter mt-3 font-display text-[44px] leading-[1.04] tracking-tight md:text-[52px]">
              Settings.
            </h1>
            <p className="mt-3 max-w-[28ch] text-[13.5px] leading-relaxed text-muted-foreground">
              Configure how the tracker scores jobs and authenticates your tools.
            </p>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-sage" />
              <span className="font-mono uppercase tracking-[0.16em]">Signed in</span>
              <span className="text-foreground/80">{state.email}</span>
            </div>

            <nav className="mt-9 flex flex-col gap-1">
              {SECTIONS.map((s, i) => {
                const isActive = active === s.id;
                const st = status[s.id];
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "press-feedback group/nav relative flex items-start gap-3 rounded-2xl px-3 py-3 text-left",
                      "transition-[background-color,color] duration-200 ease-out",
                      isActive
                        ? "surface"
                        : "bg-transparent hover:bg-foreground/[0.025]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                        isActive
                          ? "bg-apricot/15 text-apricot"
                          : "surface-sunken text-muted-foreground group-hover/nav:text-foreground",
                      )}
                    >
                      <s.icon className="size-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium leading-none text-foreground">
                          {s.title}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        {st.ok ? (
                          <CheckCircle2 className="size-3 text-sage" strokeWidth={2} />
                        ) : (
                          <CircleDashed
                            className="size-3 text-muted-foreground/50"
                            strokeWidth={2}
                          />
                        )}
                        <span className="truncate">{st.label}</span>
                      </span>
                    </span>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r-full bg-apricot" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            <div className="overflow-hidden rounded-3xl surface">
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
  return p === "groq"
    ? "Groq"
    : p === "gemini"
      ? "Gemini"
      : p === "claude"
        ? "Claude"
        : "Rules";
}
