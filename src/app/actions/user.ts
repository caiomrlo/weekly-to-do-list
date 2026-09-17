"use server";

import { db } from "@/db";
import { users, UserPreferences, DEFAULT_USER_PREFERENCES } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import {
  uploadToR2,
  deleteFromR2,
  generateAvatarKey,
  extractAvatarKeyFromUrl,
} from "@/lib/r2";
import { randomUUID } from "node:crypto";

export async function getUserPreferencesAction(): Promise<{
  preferences?: UserPreferences;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return { preferences: user?.preferences || DEFAULT_USER_PREFERENCES };
  } catch (err: unknown) {
    console.error("Error fetching preferences:", err);
    return { error: "Failed to fetch preferences." };
  }
}

export async function updateUserPreferencesAction(
  newPreferences: Partial<UserPreferences>
): Promise<{
  success?: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const currentPrefs = user?.preferences || DEFAULT_USER_PREFERENCES;
    const mergedPreferences: UserPreferences = {
      ...currentPrefs,
      ...newPreferences,
    };

    await db
      .update(users)
      .set({ preferences: mergedPreferences })
      .where(eq(users.id, session.userId));

    revalidatePath("/");
    return { success: true, preferences: mergedPreferences };
  } catch (err: unknown) {
    console.error("Error updating preferences:", err);
    return { error: "Failed to save preferences." };
  }
}

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadUserAvatarAction(formData: FormData): Promise<{
  success?: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "No image file provided." };
  }

  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    return {
      error: "Unsupported format. Please upload a JPG, PNG, WebP, GIF, or AVIF image.",
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      error: `The image exceeds the maximum allowed limit of ${
        MAX_AVATAR_SIZE_BYTES / (1024 * 1024)
      }MB.`,
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    const thumbBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(150, 150, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();

    const avatarId = randomUUID();
    const avatarKey = generateAvatarKey(avatarId);

    await uploadToR2(avatarKey, thumbBuffer, "image/webp");

    const [existingUser] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (existingUser?.image) {
      const oldKey = extractAvatarKeyFromUrl(existingUser.image);
      if (oldKey) {
        try {
          await deleteFromR2(oldKey);
        } catch (delErr) {
          console.warn("Failed to clean up prior avatar from R2:", delErr);
        }
      }
    }

    const imageUrl = `/api/avatar/${avatarId}.webp`;

    await db
      .update(users)
      .set({
        image: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    revalidatePath("/", "layout");
    return { success: true, imageUrl };
  } catch (err: unknown) {
    console.error("Error uploading user avatar:", err);
    return { error: "Failed to upload avatar image. Please try again." };
  }
}

export async function deleteUserAvatarAction(): Promise<{
  success?: boolean;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const [existingUser] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (existingUser?.image) {
      const oldKey = extractAvatarKeyFromUrl(existingUser.image);
      if (oldKey) {
        try {
          await deleteFromR2(oldKey);
        } catch (delErr) {
          console.warn("Failed to delete avatar from R2:", delErr);
        }
      }
    }

    await db
      .update(users)
      .set({
        image: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting user avatar:", err);
    return { error: "Failed to remove avatar image." };
  }
}
