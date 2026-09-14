import { vi } from "vitest";
import "dotenv/config";

const cookieMap = new Map<string, string>();

export const mockCookieStore = {
  get: vi.fn((name: string) => {
    const val = cookieMap.get(name);
    return val !== undefined ? { name, value: val } : undefined;
  }),
  set: vi.fn((nameOrObj: string | { name: string; value: string }, value?: string) => {
    if (typeof nameOrObj === "object") {
      cookieMap.set(nameOrObj.name, nameOrObj.value);
    } else {
      cookieMap.set(nameOrObj, value!);
    }
  }),
  delete: vi.fn((nameOrObj: string | { name: string }) => {
    if (typeof nameOrObj === "object") {
      cookieMap.delete(nameOrObj.name);
    } else {
      cookieMap.delete(nameOrObj);
    }
  }),
  has: vi.fn((name: string) => cookieMap.has(name)),
  clear: () => {
    cookieMap.clear();
  },
};

const nextHeadersMock = {
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => {
    const cookieHeader = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return new Headers(cookieHeader ? { cookie: cookieHeader } : {});
  }),
};

vi.mock("next/headers", () => nextHeadersMock);
vi.mock("next/headers.js", () => nextHeadersMock);

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
