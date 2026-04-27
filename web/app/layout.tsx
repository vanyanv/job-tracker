import type { Metadata } from "next";
import "./globals.css";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { cn } from "@/lib/utils";
import { GrainOverlay } from "./_components/grain-overlay";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "Job Tracker",
  description: "Find your next role, calmly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "dark font-sans",
        geistSans.variable,
        geistMono.variable,
        fraunces.variable,
      )}
    >
      <body>
        <GrainOverlay />
        {children}
      </body>
    </html>
  );
}
