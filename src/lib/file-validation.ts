import { fileTypeFromBuffer } from "file-type";

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type FileValidationSuccess = {
  valid: true;
  mime: string;
  ext: string;
};

export type FileValidationFailure = {
  valid: false;
  error: string;
};

export type FileValidationResult = FileValidationSuccess | FileValidationFailure;

/**
 * Checks if the buffer contains the standard PDF magic header (%PDF-)
 * within the first 1024 bytes as defined by ISO 32000-1 (PDF specification).
 */
function hasPdfHeader(buffer: Buffer | Uint8Array): boolean {
  const searchLimit = Math.min(buffer.length, 1024);
  const slice = buffer.subarray(0, searchLimit);
  // %PDF- in ASCII: [0x25, 0x50, 0x44, 0x46, 0x2d]
  const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return Buffer.from(slice).includes(pdfHeader);
}

/**
 * Validates a file buffer against magic numbers (byte signatures) using file-type
 * and checks if the detected MIME type is present in the allowed whitelist.
 */
export async function validateFileBuffer(
  buffer: Buffer | Uint8Array,
  allowedMimes: Set<string>
): Promise<FileValidationResult> {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty file buffer." };
  }

  // 1. Detect file type by magic numbers using file-type
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    if (!allowedMimes.has(detected.mime)) {
      return {
        valid: false,
        error: `Unsupported file format: ${detected.mime}.`,
      };
    }

    return {
      valid: true,
      mime: detected.mime,
      ext: detected.ext,
    };
  }

  // 2. Fallback for PDF: ISO 32000 allows %PDF- header within the first 1024 bytes
  if (allowedMimes.has("application/pdf") && hasPdfHeader(buffer)) {
    return {
      valid: true,
      mime: "application/pdf",
      ext: "pdf",
    };
  }

  return {
    valid: false,
    error: "File signature not recognized or unsupported format.",
  };
}
