import Link from "next/link";
import { Briefcase } from "lucide-react";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { WarmGlow } from "@/app/_components/warm-glow";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <WarmGlow position="top-left" size="xl" hue="apricot" />
      <WarmGlow position="bottom-right" size="lg" hue="cornflower" className="opacity-50" />

      <div className="relative w-full max-w-[440px]">
        <Link
          href="/"
          className="mx-auto mb-10 flex w-fit items-center gap-2.5"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-apricot/30">
            <Briefcase className="size-4 text-foreground" strokeWidth={1.75} />
          </span>
          <span className="font-display italic text-base font-medium tracking-tight">
            Job Tracker
          </span>
        </Link>

        {/* Editorial cover headline — sits above the auth card */}
        <div className="hearth-enter mb-8 text-center">
          <div className="label-caps text-muted-foreground">Welcome</div>
          <h1 className="mt-3 font-display text-[40px] leading-[0.98] tracking-tight md:text-[52px]">
            <span className="block font-medium text-foreground">Find your next</span>
            <span className="block italic font-normal text-foreground/75">
              role, calmly.
            </span>
          </h1>
        </div>

        <div className="hearth-enter bento-stage-2 rounded-md surface px-6 py-7 md:px-8 md:py-9">
          <p className="text-center text-[13.5px] leading-relaxed text-muted-foreground">
            Continue with your account to access your pipeline.
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full justify-center gap-2.5 rounded-md"
              >
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
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full justify-center gap-2.5 rounded-md"
              >
                <GitHubMark />
                Continue with GitHub
              </Button>
            </form>
          </div>

          <div className="mt-7 flex items-center justify-center gap-2.5 text-[11px] text-muted-foreground">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-apricot/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-apricot" />
            </span>
            <span className="label-caps">Scraper running · every 2h</span>
          </div>
        </div>

        <p className="mt-6 text-balance text-center text-[11px] leading-relaxed text-muted-foreground/80">
          By continuing, you agree to the{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </a>{" "}
          policy.
        </p>
      </div>
    </div>
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
