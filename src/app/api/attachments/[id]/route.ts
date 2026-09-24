import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  getPresignedViewUrl,
  getPresignedDownloadUrl,
  getR2Object,
} from "@/lib/r2";
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

    // Explicit download requested: force attachment disposition via presigned URL
    if (download) {
      const targetUrl = await getPresignedDownloadUrl(
        effectivePath,
        3600,
        attachment.fileName
      );
      return NextResponse.redirect(targetUrl, 307);
    }

    // Thumbnails and image formats: safe for direct inline redirect via presigned URL
    const isImage = attachment.contentType.startsWith("image/");
    if (isThumb || isImage) {
      const targetUrl = await getPresignedViewUrl(
        effectivePath,
        3600,
        isThumb ? `thumb_${attachment.fileName}` : attachment.fileName
      );
      return NextResponse.redirect(targetUrl, 307);
    }

    // PDF files: stream with strict sandbox and nosniff headers for secure inline viewing
    if (attachment.contentType === "application/pdf") {
      const r2Response = await getR2Object(effectivePath);
      if (!r2Response.Body) {
        return NextResponse.json(
          { error: "Attachment content not found." },
          { status: 404 }
        );
      }

      const headers = new Headers();
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Security-Policy", "sandbox");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(attachment.fileName)}"`
      );
      headers.set("Cache-Control", "private, max-age=3600");
      if (r2Response.ContentLength) {
        headers.set("Content-Length", r2Response.ContentLength.toString());
      }

      const stream =
        typeof r2Response.Body.transformToWebStream === "function"
          ? r2Response.Body.transformToWebStream()
          : (r2Response.Body as unknown as ReadableStream);

      return new NextResponse(stream, {
        status: 200,
        headers,
      });
    }

    // Generic or non-previewable attachments: default to forced download
    const fallbackDownloadUrl = await getPresignedDownloadUrl(
      effectivePath,
      3600,
      attachment.fileName
    );
    return NextResponse.redirect(fallbackDownloadUrl, 307);
  } catch (err: unknown) {
    console.error("Error generating attachment URL:", err);
    return NextResponse.json(
      { error: "Internal server error while processing attachment." },
      { status: 500 }
    );
  }
}
