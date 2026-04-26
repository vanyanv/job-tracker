import Link from "next/link";
import { Briefcase } from "lucide-react";
import { signIn } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 md:px-6">
      {/* ambient corner glow — single emerald accent, soft */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          background:
            "radial-gradient(900px 500px at 88% -10%, oklch(0.696 0.17 162.48 / 0.12), transparent 60%)",
        }}
      />

      <div className="w-full max-w-sm md:max-w-3xl">
        <Card className="overflow-hidden rounded-2xl border-foreground/8 bg-card/60 ring-0 shadow-[0_1px_0_rgba(0,0,0,0.02),0_24px_40px_-32px_rgba(0,0,0,0.18)] gap-0 py-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            {/* Left — sign-in actions */}
            <div className="p-7 md:p-9">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium tracking-tight"
              >
                <span className="flex size-7 items-center justify-center rounded-md border border-foreground/10 bg-foreground/[0.03]">
                  <Briefcase className="size-3.5" strokeWidth={1.75} />
                </span>
                <span>Job Tracker</span>
              </Link>

              <div className="mt-10">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Welcome
                </div>
                <h1 className="mt-1.5 text-3xl font-medium tracking-tighter">
                  Sign in.
                </h1>
                <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
                  Continue with your work account to access your pipeline.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/dashboard" });
                  }}
                >
                  <Button type="submit" variant="outline" size="lg" className="w-full justify-center gap-2.5">
                    <GoogleMark />
                    Continue with Google
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await signIn("github", { redirectTo: "/dashboard" });
                  }}
                >
                  <Button type="submit" variant="outline" size="lg" className="w-full justify-center gap-2.5">
                    <GitHubMark />
                    Continue with GitHub
                  </Button>
                </form>
              </div>

              <Separator className="my-7 bg-foreground/5" />

              <p className="text-balance text-xs leading-relaxed text-muted-foreground">
                By continuing, you agree to the{" "}
                <a
                  href="/terms"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Privacy
                </a>{" "}
                policy.
              </p>
            </div>

            {/* Right — brand panel (asymmetric, no image needed) */}
            <div className="relative hidden border-l border-foreground/5 bg-foreground/[0.015] p-9 md:flex md:flex-col">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(420px 280px at 80% 110%, oklch(0.696 0.17 162.48 / 0.10), transparent 65%)",
                }}
              />

              <div className="relative">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                  Pipeline · Live
                </div>
                <p className="mt-3 max-w-[26ch] text-2xl font-medium tracking-tighter leading-tight">
                  Apply to fresh roles before they hit the front page.
                </p>
              </div>

              <ol className="relative mt-auto space-y-4">
                <Step n="01" label="Scrape" copy="Ashby, Greenhouse, Lever — every two hours." />
                <Step n="02" label="Score" copy="Each role ranked against your resume." />
                <Step n="03" label="Apply" copy="Batch-open your queue and burn through it." />
                <Step n="04" label="Track" copy="Gmail sync flags interviews and rejections." />
              </ol>

              <div className="relative mt-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Scraper running
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step({ n, label, copy }: { n: string; label: string; copy: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 font-mono text-[10px] tabular-nums tracking-wide text-muted-foreground/70">
        {n}
      </span>
      <div className="min-w-0 flex-1 border-l border-foreground/5 pl-3">
        <div className="text-sm font-medium tracking-tight text-foreground">
          {label}
        </div>
        <div className="text-xs leading-relaxed text-muted-foreground">{copy}</div>
      </div>
    </li>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M12 .5C5.373.5 0 5.873 0 12.5c0 5.302 3.438 9.8 8.205 11.385.6.111.82-.26.82-.577 0-.286-.011-1.231-.017-2.234-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.838 1.237 1.838 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.42-1.305.762-1.605-2.665-.303-5.466-1.332-5.466-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.527.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.649.243 2.873.119 3.176.769.84 1.236 1.911 1.236 3.221 0 4.609-2.806 5.624-5.479 5.921.43.371.815 1.103.815 2.222 0 1.606-.014 2.898-.014 3.293 0 .32.216.694.825.576C20.565 22.296 24 17.799 24 12.5 24 5.873 18.627.5 12 .5z"
      />
    </svg>
  );
}
