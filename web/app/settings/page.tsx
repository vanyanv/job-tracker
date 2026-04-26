import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "./_components/settings-shell";
import type { ResumeProfile } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      email: true,
      name: true,
      image: true,
      aiProvider: true,
      aiApiKey: true,
      gmailToken: true,
      apiKey: true,
      resumeText: true,
      resumeParsed: true,
    },
  });

  if (!user) redirect("/signin");

  return (
    <SettingsShell
      user={{
        email: user.email,
        name: user.name,
        image: user.image,
        aiProvider: (user.aiProvider as "groq" | "gemini" | "claude" | "rules" | null) ?? "rules",
        hasAiApiKey: !!user.aiApiKey,
        gmailConnected: !!user.gmailToken,
        apiKey: user.apiKey,
        hasResume: !!user.resumeText,
        resumeParsed: (user.resumeParsed as ResumeProfile | null) ?? null,
      }}
    />
  );
}
