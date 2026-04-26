"use client";

import * as React from "react";
import { Upload, Loader2, FileText, AlertCircle, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ResumeProfile } from "@/lib/ai/provider";
import { SectionHeader } from "./section-header";

const MAX_BYTES = 5 * 1024 * 1024;

export function ResumeSection({
  resumeParsed,
  hasResume,
  onParsed,
}: {
  resumeParsed: ResumeProfile | null;
  hasResume: boolean;
  onParsed: (parsed: ResumeProfile) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progressLabel, setProgressLabel] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("PDF must be under 5 MB.");
      return;
    }
    setUploading(true);
    setProgressLabel("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      setProgressLabel("Extracting text…");
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      setProgressLabel("Parsing with AI…");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Upload failed (${res.status})`);
      }
      const data = await res.json();
      onParsed(data.parsed as ResumeProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgressLabel("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="02 — Profile source"
        title="Resume"
        description="Drop a PDF and your AI provider parses it into a structured profile (skills, titles, years of experience). That profile is what every incoming job is scored against."
        action={
          <Badge tone={hasResume ? "active" : "warning"}>
            {hasResume ? "Parsed" : "Required"}
          </Badge>
        }
      />

      <div className="px-7 py-7 md:px-9">
        {/* Drop zone */}
        <label
          htmlFor="resume-input"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={cn(
            "group/drop relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/30 px-6 py-10 text-center transition-all",
            "cursor-pointer",
            dragOver
              ? "border-foreground/40 bg-foreground/[0.04] scale-[1.005]"
              : "border-foreground/15 hover:border-foreground/25 hover:bg-muted/50",
            uploading && "pointer-events-none opacity-80",
          )}
        >
          <input
            ref={inputRef}
            id="resume-input"
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border border-foreground/10 bg-background shadow-xs transition-transform",
              !uploading && "group-hover/drop:-translate-y-0.5",
            )}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-foreground/70" strokeWidth={1.75} />
            ) : (
              <Upload className="size-5 text-foreground/70" strokeWidth={1.75} />
            )}
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">
              {uploading ? progressLabel : hasResume ? "Replace resume" : "Drop your resume PDF"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {uploading ? "Don't refresh — extraction & parse in flight" : "or click to browse — max 5 MB, PDF only"}
            </div>
          </div>
        </label>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* Parsed preview */}
        {resumeParsed && (
          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-foreground/5 pt-7 lg:grid-cols-[1fr_240px]">
            <div className="min-w-0 space-y-5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Summary
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  {resumeParsed.summary}
                </p>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Skills
                  <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">
                    ({resumeParsed.skills.length})
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {resumeParsed.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-md border border-foreground/10 bg-background px-2 py-0.5 text-xs font-medium text-foreground/80"
                    >
                      {s}
                    </span>
                  ))}
                  {resumeParsed.skills.length === 0 && (
                    <span className="text-xs text-muted-foreground">No skills extracted.</span>
                  )}
                </div>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Titles
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {resumeParsed.titles.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-md border border-foreground/10 bg-background px-2 py-0.5 text-xs font-medium text-foreground/80"
                    >
                      {t}
                    </span>
                  ))}
                  {resumeParsed.titles.length === 0 && (
                    <span className="text-xs text-muted-foreground">No titles extracted.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Side stat */}
            <aside className="flex flex-col gap-3 lg:border-l lg:border-foreground/5 lg:pl-6">
              <div className="rounded-xl border border-foreground/10 bg-background p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Experience
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-medium tabular-nums tracking-tight text-foreground">
                    {resumeParsed.yearsExperience}
                  </span>
                  <span className="text-sm text-muted-foreground">yrs</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <Check className="size-3" strokeWidth={2.5} />
                  Profile active
                </div>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 py-2.5 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/20 hover:text-foreground active:translate-y-px"
              >
                <RotateCcw className="size-3.5" strokeWidth={1.75} />
                Re-parse with current provider
              </button>
            </aside>
          </div>
        )}

        {!resumeParsed && !uploading && hasResume && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="size-3.5" strokeWidth={1.75} />
            Resume on file but no parsed profile yet — re-upload to refresh.
          </div>
        )}
      </div>
    </div>
  );
}
