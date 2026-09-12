import { describe, it, expect } from "vitest";
import {
  sanitizeFileName,
  generateFilePath,
  generateThumbnailPath,
} from "@/lib/r2";

describe("r2 storage utils", () => {
  describe("sanitizeFileName", () => {
    it("should keep safe alphanumeric characters, dots, dashes, and underscores", () => {
      expect(sanitizeFileName("report-2026_final.v1.pdf")).toBe("report-2026_final.v1.pdf");
    });

    it("should strip directory traversal and paths to keep only the basename", () => {
      expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
      expect(sanitizeFileName("..\\..\\windows\\system32\\calc.exe")).toBe("calc.exe");
      expect(sanitizeFileName("/var/uploads/test.png")).toBe("test.png");
    });

    it("should replace spaces and unsupported symbols with underscores", () => {
      expect(sanitizeFileName("my task file (draft).docx")).toBe("my_task_file__draft_.docx");
      expect(sanitizeFileName("price$#@!.txt")).toBe("price____.txt");
    });

    it("should fallback to 'unnamed-file' for empty, whitespace, or slash-only names", () => {
      expect(sanitizeFileName("")).toBe("unnamed-file");
      // @ts-expect-error testing runtime falsy value
      expect(sanitizeFileName(null)).toBe("unnamed-file");
      // @ts-expect-error testing runtime falsy value
      expect(sanitizeFileName(undefined)).toBe("unnamed-file");
      expect(sanitizeFileName("   ")).toBe("unnamed-file");
      expect(sanitizeFileName("///")).toBe("unnamed-file");
      expect(sanitizeFileName("\\\\\\")).toBe("unnamed-file");
    });

    it("should convert unsupported symbols into underscores", () => {
      expect(sanitizeFileName("###")).toBe("___");
      expect(sanitizeFileName("***")).toBe("___");
    });
  });

  describe("generateFilePath", () => {
    it("should generate proper storage path with attachment ID and sanitized filename", () => {
      const path = generateFilePath("att-123", "User Photo (1).jpg");
      expect(path).toBe("files/att-123/User_Photo__1_.jpg");
    });

    it("should prevent directory traversal injection in the filename", () => {
      const path = generateFilePath("att-123", "../../malicious.sh");
      expect(path).toBe("files/att-123/malicious.sh");
    });
  });

  describe("generateThumbnailPath", () => {
    it("should generate standardized thumbnail path with attachment ID", () => {
      const path = generateThumbnailPath("att-456");
      expect(path).toBe("files/att-456/thumb.webp");
    });
  });
});
