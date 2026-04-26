import { NextRequest, NextResponse } from "next/server";
import { getDocumentProxy, extractText } from "unpdf";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/ai/provider";
import { auth } from "@/auth";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Field 'file' is required and must be a file upload" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum size is 5 MB." }, { status: 413 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are accepted (Content-Type: application/pdf)" },
      { status: 415 }
    );
  }

  let resumeText: string;
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    await pdf.destroy();
    resumeText = text as string;
  } catch (err) {
    console.error("[api/resume] PDF extraction error:", err);
    return NextResponse.json(
      { error: "Failed to extract text from PDF. Ensure the file is a valid, non-encrypted PDF." },
      { status: 500 }
    );
  }

  if (!resumeText || resumeText.trim().length < 10) {
    return NextResponse.json(
      { error: "Could not extract meaningful text from this PDF. Try a different file." },
      { status: 422 }
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: session.user.email },
    select: { id: true, aiProvider: true, aiApiKey: true },
  });

  const provider = getProvider(user);

  let parsed;
  try {
    parsed = await provider.parseResume(resumeText);
  } catch (err) {
    console.error("[api/resume] parseResume error:", err);
    return NextResponse.json(
      { error: "Failed to parse resume content. Check your AI provider settings or switch to 'rules'." },
      { status: 500 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resumeText,
      resumeParsed: parsed,
      skillsProfile: parsed.skills.join(","),
    },
  });

  return NextResponse.json({ ok: true, parsed });
}
