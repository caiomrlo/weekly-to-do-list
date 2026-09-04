"use server";

import { db } from "@/db";
import { users, UserPreferences, DEFAULT_USER_PREFERENCES } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getUserPreferencesAction(): Promise<{
  preferences?: UserPreferences;
  error?: string;
}> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Não autenticado." };
  }

  try {
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return { preferences: user?.preferences || DEFAULT_USER_PREFERENCES };
  } catch (err: unknown) {
    console.error("Erro ao buscar preferências:", err);
    return { error: "Erro ao buscar preferências." };
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
    return { error: "Não autenticado." };
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
    console.error("Erro ao atualizar preferências:", err);
    return { error: "Erro ao salvar preferências." };
  }
}
