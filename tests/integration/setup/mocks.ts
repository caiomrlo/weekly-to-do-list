import { vi } from "vitest";
import "dotenv/config";

const cookieMap = new Map<string, string>();

export const mockCookieStore = {
  get: vi.fn((name: string) => {
    const val = cookieMap.get(name);
    return val !== undefined ? { name, value: val } : undefined;
  }),
  set: vi.fn((name: string, value: string) => {
    cookieMap.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    cookieMap.delete(name);
  }),
  has: vi.fn((name: string) => cookieMap.has(name)),
  clear: () => {
    cookieMap.clear();
  },
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();
  return {
    ...actual,
    uploadToR2: vi.fn(async () => {}),
    deleteFromR2: vi.fn(async () => {}),
    deleteManyFromR2: vi.fn(async () => {}),
    getPresignedViewUrl: vi.fn(
      async (filePath: string, _expires?: number, fileName?: string) =>
        `https://signed-view.r2.test/${filePath}?name=${fileName || ""}`
    ),
    getPresignedDownloadUrl: vi.fn(
      async (filePath: string, _expires?: number, fileName?: string) =>
        `https://signed-download.r2.test/${filePath}?name=${fileName || ""}`
    ),
  };
});
