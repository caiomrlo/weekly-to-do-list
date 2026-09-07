import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getPresignedViewUrl, getPresignedDownloadUrl } from "@/lib/r2";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
  }

  try {
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, session.userId)))
      .limit(1);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    const isThumb = request.nextUrl.searchParams.get("thumb") === "1";
    const download = request.nextUrl.searchParams.get("download") === "1";

    const effectivePath =
      isThumb && attachment.thumbnailPath
        ? attachment.thumbnailPath
        : attachment.filePath;

    const targetUrl = download
      ? await getPresignedDownloadUrl(effectivePath, 3600, attachment.fileName)
      : await getPresignedViewUrl(
          effectivePath,
          3600,
          isThumb ? `thumb_${attachment.fileName}` : attachment.fileName
        );

    return NextResponse.redirect(targetUrl, 307);
  } catch (err: unknown) {
    console.error("Error generating attachment URL:", err);
    return NextResponse.json(
      { error: "Internal server error while processing attachment." },
      { status: 500 }
    );
  }
}

