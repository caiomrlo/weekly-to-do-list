import { NextRequest, NextResponse } from "next/server";
import { getR2Object } from "@/lib/r2";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid avatar ID." }, { status: 400 });
  }

  const avatarId = id.replace(/\.webp$/i, "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!avatarId) {
    return NextResponse.json({ error: "Invalid avatar ID." }, { status: 400 });
  }

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (r2PublicUrl) {
    const cleanPublicUrl = r2PublicUrl.replace(/\/+$/, "");
    return NextResponse.redirect(`${cleanPublicUrl}/avatars/${avatarId}.webp`, 307);
  }

  try {
    const key = `avatars/${avatarId}.webp`;
    const r2Response = await getR2Object(key);

    if (!r2Response.Body) {
      return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
    }

    const byteArray = await r2Response.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    const errorObj = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (errorObj?.name === "NoSuchKey" || errorObj?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
    }

    console.error("Error serving avatar:", err);
    return NextResponse.json(
      { error: "Internal server error while retrieving avatar." },
      { status: 500 }
    );
  }
}
