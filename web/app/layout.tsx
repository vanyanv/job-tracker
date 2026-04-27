import type { Metadata } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { cn } from "@/lib/utils";
import { GrainOverlay } from "./_components/grain-overlay";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["italic", "normal"],
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
  display: "swap",
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
        "font-sans",
        inter.variable,
        jetbrainsMono.variable,
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
