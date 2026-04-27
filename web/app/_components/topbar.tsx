"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Pipeline", match: (p) => p === "/dashboard" },
  {
    href: "/dashboard/queue",
    label: "Queue",
    match: (p) => p.startsWith("/dashboard/queue"),
  },
  { href: "/analytics", label: "Analytics", match: (p) => p.startsWith("/analytics") },
  { href: "/settings", label: "Settings", match: (p) => p.startsWith("/settings") },
];

export function Topbar({
  user,
  active,
}: {
  user?: { email: string; name: string | null; image: string | null };
  active?: "pipeline" | "queue" | "analytics" | "settings";
}) {
  const pathname = usePathname() ?? "/dashboard";
  return (
    <header className="sticky top-0 z-30 surface-elevated border-b divider-warm shadow-[0_1px_3px_-1px_oklch(0_0_0/0.06)]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center rounded-md bg-apricot/30">
            <Briefcase className="size-3.5 text-foreground" strokeWidth={1.75} />
          </span>
          <span className="font-display text-[16px] italic font-medium tracking-tight">
            Job Tracker
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-md surface-sunken px-1 py-1 md:flex">
          {NAV.map((item) => {
            const isActive =
              active !== undefined
                ? active === item.label.toLowerCase()
                : item.match(pathname);
            return (
              <NavLink key={item.href} href={item.href} active={isActive}>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="press-feedback hidden h-8 items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground sm:inline-flex"
            aria-label="Search (coming soon)"
          >
            <span className="label-caps">Search</span>
            <kbd className="inline-flex items-center rounded-sm bg-foreground/8 px-1.5 py-px font-mono text-[10px] tracking-tight text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {user && (
            <Link
              href="/settings"
              className="press-feedback group/u flex items-center gap-2 rounded-md surface px-1 py-1 pr-3 transition-colors hover:bg-foreground/5"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-6 rounded-sm" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-sm bg-apricot/35 font-mono text-[11px] font-medium text-foreground">
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:inline group-hover/u:text-foreground">
                {firstName(user.name) || user.email.split("@")[0]}
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function firstName(name: string | null): string {
  if (!name) return "";
  return name.split(" ")[0] ?? "";
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-sm px-3 py-1 text-[12.5px] font-medium transition-colors duration-150",
        active
          ? "bg-foreground text-background shadow-[inset_0_1px_0_oklch(1_0_0/12%),0_4px_12px_-4px_oklch(0_0_0/0.25)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
