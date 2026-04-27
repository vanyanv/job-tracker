"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, Search } from "lucide-react";
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
  /** Optional override for active nav. Falls back to first match in NAV. */
  active?: "pipeline" | "queue" | "analytics" | "settings";
}) {
  return (
    <header className="sticky top-0 z-30 surface-elevated border-b divider-warm">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-xl surface">
            <Briefcase
              className="size-3.5 text-apricot"
              strokeWidth={1.75}
            />
          </span>
          <span className="font-display text-[15px] font-medium tracking-tight">
            Job Tracker
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full surface-sunken px-1 py-1 md:flex">
          {NAV.map((item) => {
            const isActive =
              active === item.label.toLowerCase() ||
              (active === undefined && item.match("/" + (item.href.split("/")[1] ?? "")));
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
            className="hidden h-9 items-center gap-2 rounded-full border border-border bg-foreground/2.5 px-3 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
            aria-label="Search"
          >
            <Search className="size-3.5" strokeWidth={1.75} />
            <span>Search</span>
            <kbd className="ml-2 inline-flex items-center rounded-md bg-foreground/8 px-1.5 py-0.5 font-mono text-[10px] tracking-tight text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {user && (
            <Link
              href="/settings"
              className="group/u flex items-center gap-2 rounded-full surface px-1 py-1 pr-3 transition-colors hover:bg-foreground/5"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-7 rounded-full" />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-apricot/15 font-mono text-[11px] font-medium text-apricot">
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
        "rounded-full px-3.5 py-1.5 text-[13px] font-medium",
        active
          ? "bg-card text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/8%),0_2px_8px_-3px_oklch(0_0_0/30%)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
