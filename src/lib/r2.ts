import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "";

export const r2 = new S3Client({
  region: "auto", // Required by S3 SDK, ignored by Cloudflare R2
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export function sanitizeFileName(rawName: string): string {
  if (!rawName) return "unnamed-file";
  const normalized = rawName.normalize("NFC");
  const baseName = normalized.replace(/^.*[\\/]/, "").trim();
  const sanitized = baseName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return sanitized || "unnamed-file";
}

export function generateFilePath(attachmentId: string, fileName: string): string {
  const cleanName = sanitizeFileName(fileName);
  return `files/${attachmentId}/${cleanName}`;
}

export function generateThumbnailPath(attachmentId: string): string {
  return `files/${attachmentId}/thumb.webp`;
}

export async function uploadToR2(
  filePath: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
    Body: buffer,
    ContentType: contentType,
  });

  await r2.send(command);
}

export async function deleteFromR2(filePath: string): Promise<void> {
  if (!filePath) return;
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
  });

  await r2.send(command);
}

export async function deleteManyFromR2(filePaths: string[]): Promise<void> {
  const validKeys = filePaths.filter(Boolean);
  if (validKeys.length === 0) return;

  const command = new DeleteObjectsCommand({
    Bucket: R2_BUCKET,
    Delete: {
      Objects: validKeys.map((Key) => ({ Key })),
      Quiet: true,
    },
  });

  await r2.send(command);
}

export async function getPresignedViewUrl(
  filePath: string,
  expiresInSeconds = 3600,
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
    ResponseContentDisposition: fileName
      ? `inline; filename="${encodeURIComponent(fileName)}"`
      : undefined,
  });

  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

export async function getPresignedDownloadUrl(
  filePath: string,
  expiresInSeconds = 3600,
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: filePath,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${encodeURIComponent(fileName)}"`
      : "attachment",
  });

  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

export function generateAvatarKey(avatarId: string): string {
  const cleanId = sanitizeFileName(avatarId);
  return `avatars/${cleanId}.webp`;
}

export function extractAvatarKeyFromUrl(
  imageUrl: string | null | undefined
): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/([a-f0-9-]{36})\.webp/i);
  return match ? `avatars/${match[1]}.webp` : null;
}

export async function getR2Object(key: string) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return r2.send(command);
}
