import { describe, it, expect } from "vitest";
import {
  validateFileBuffer,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ALLOWED_AVATAR_MIME_TYPES,
} from "@/lib/file-validation";

// Sample valid file headers
const VALID_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// Standard JPEG header: FF D8 FF E0 00 10 4A 46 49 46
const VALID_JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// Standard WebP header: RIFF....WEBPVP8
const VALID_WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
]);

// Standard GIF header: GIF89a
const VALID_GIF_HEADER = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04", "binary");

// Standard PDF: %PDF-1.5
const VALID_PDF = Buffer.from("%PDF-1.5\n%Some binary bytes \xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj");

// PDF with leading whitespace/comments within first 1024 bytes (ISO 32000 compliant)
const VALID_PDF_WITH_OFFSET = Buffer.from("   \r\n%PDF-1.7\nstream\nendstream");

describe("Unit: file-validation (Magic Bytes)", () => {
  it("should validate and identify valid PNG buffers", async () => {
    const res = await validateFileBuffer(VALID_1X1_PNG, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.mime).toBe("image/png");
      expect(res.ext).toBe("png");
    }
  });

  it("should validate and identify valid JPEG buffers", async () => {
    const res = await validateFileBuffer(VALID_JPEG_HEADER, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.mime).toBe("image/jpeg");
      expect(res.ext).toBe("jpg");
    }
  });

  it("should validate and identify valid WebP buffers", async () => {
    const res = await validateFileBuffer(VALID_WEBP_HEADER, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.mime).toBe("image/webp");
      expect(res.ext).toBe("webp");
    }
  });

  it("should validate and identify valid GIF buffers", async () => {
    const res = await validateFileBuffer(VALID_GIF_HEADER, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.mime).toBe("image/gif");
      expect(res.ext).toBe("gif");
    }
  });

  it("should validate and identify valid PDF buffers", async () => {
    const res = await validateFileBuffer(VALID_PDF, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.mime).toBe("application/pdf");
      expect(res.ext).toBe("pdf");
    }
  });

  it("should validate offset %PDF- headers within 1024 bytes according to ISO 32000", async () => {
    const res = await validateFileBuffer(VALID_PDF_WITH_OFFSET, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.mime).toBe("application/pdf");
      expect(res.ext).toBe("pdf");
    }
  });

  it("should reject plain text or HTML pretending to be a document or image", async () => {
    const fakeHtml = Buffer.from("<script>alert('xss')</script>");
    const res = await validateFileBuffer(fakeHtml, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeDefined();
    }

    const plainText = Buffer.from("Hello world, this is a plain text file.");
    const res2 = await validateFileBuffer(plainText, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res2.valid).toBe(false);
  });

  it("should reject empty buffer", async () => {
    const empty = Buffer.alloc(0);
    const res = await validateFileBuffer(empty, ALLOWED_ATTACHMENT_MIME_TYPES);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBe("Empty file buffer.");
    }
  });

  it("should reject formats not present in the allowed whitelist (e.g. PDF for avatar)", async () => {
    // Avatars do not allow PDFs
    const res = await validateFileBuffer(VALID_PDF, ALLOWED_AVATAR_MIME_TYPES);
    expect(res.valid).toBe(false);
  });
});
